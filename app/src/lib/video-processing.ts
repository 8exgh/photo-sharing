import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { promisify } from 'util';
import { log } from './logger';

const run = promisify(execFile);
const MAX_OUTPUT = 16 * 1024 * 1024;

// ffmpeg/ffprobe come from PATH (apk add ffmpeg in the image, preinstalled on
// CI runners) or from FFMPEG_PATH / FFPROBE_PATH for local development.
function ffmpegBin(): string {
  return process.env.FFMPEG_PATH || 'ffmpeg';
}

function ffprobeBin(): string {
  if (process.env.FFPROBE_PATH) return process.env.FFPROBE_PATH;
  if (process.env.FFMPEG_PATH) return join(dirname(process.env.FFMPEG_PATH), 'ffprobe');
  return 'ffprobe';
}

export interface ProbeResult {
  formatName: string;
  durationSeconds: number;
  video: { codec: string; width: number; height: number; pixFmt: string } | null;
  audio: { codec: string } | null;
}

interface FfprobeJson {
  format?: { format_name?: string; duration?: string };
  streams?: Array<{
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    pix_fmt?: string;
  }>;
}

function describeFailure(error: unknown): string {
  const err = error as NodeJS.ErrnoException & { stderr?: string };
  if (err.code === 'ENOENT') return `${err.path ?? 'ffmpeg'} is not installed`;
  const stderr = (err.stderr || '').trim().split('\n').slice(-5).join(' | ');
  return stderr || err.message || String(error);
}

export async function probeVideo(path: string): Promise<ProbeResult> {
  let stdout: string;
  try {
    ({ stdout } = await run(
      ffprobeBin(),
      ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', path],
      { maxBuffer: MAX_OUTPUT }
    ));
  } catch (error) {
    throw new Error(`ffprobe failed: ${describeFailure(error)}`);
  }

  const parsed = JSON.parse(stdout) as FfprobeJson;
  const video = parsed.streams?.find((s) => s.codec_type === 'video');
  const audio = parsed.streams?.find((s) => s.codec_type === 'audio');
  return {
    formatName: parsed.format?.format_name ?? '',
    durationSeconds: Number(parsed.format?.duration) || 0,
    video: video
      ? {
          codec: video.codec_name ?? '',
          width: video.width ?? 0,
          height: video.height ?? 0,
          pixFmt: video.pix_fmt ?? '',
        }
      : null,
    audio: audio ? { codec: audio.codec_name ?? '' } : null,
  };
}

// What to do with an upload so every browser can stream it:
//  - keep-webm:      VP8/VP9/AV1 + Opus/Vorbis in WebM plays everywhere as-is
//  - remux-mp4:      H.264 + AAC/MP3 already; rewrite the container only so
//                    the index (moov) sits at the front for instant start
//  - transcode-mp4:  anything else becomes H.264/AAC MP4
export type ProcessingPlan = 'keep-webm' | 'remux-mp4' | 'transcode-mp4';

export function planFor(probe: ProbeResult, sourceMimeType: string): ProcessingPlan {
  if (!probe.video) throw new Error('The file has no video stream');
  const audioOk = (codecs: string[]) => !probe.audio || codecs.includes(probe.audio.codec);

  const isWebm = sourceMimeType === 'video/webm' && /webm|matroska/.test(probe.formatName);
  if (isWebm && ['vp8', 'vp9', 'av1'].includes(probe.video.codec) && audioOk(['opus', 'vorbis'])) {
    return 'keep-webm';
  }

  const isMp4Family = /mp4|mov/.test(probe.formatName);
  if (
    isMp4Family &&
    probe.video.codec === 'h264' &&
    probe.video.pixFmt === 'yuv420p' &&
    audioOk(['aac', 'mp3'])
  ) {
    return 'remux-mp4';
  }

  return 'transcode-mp4';
}

export interface ProcessedVideo {
  mimeType: string;
  fileSize: number;
  width: number;
  height: number;
  durationSeconds: number;
  videoCodec: string;
  audioCodec: string | null;
  transcoded: boolean;
  poster: boolean;
}

export interface ProcessingTarget {
  sourcePath: string;
  sourceMimeType: string;
  outputPathFor: (mimeType: string) => string;
  posterPath: string;
}

async function ffmpeg(args: string[]): Promise<void> {
  try {
    await run(ffmpegBin(), ['-y', '-v', 'error', '-nostdin', ...args], { maxBuffer: MAX_OUTPUT });
  } catch (error) {
    throw new Error(`ffmpeg failed: ${describeFailure(error)}`);
  }
}

// Turns the uploaded source into a browser-ready file plus a poster frame.
// On success the source is gone and the output sits at outputPathFor(mime).
// Throws (leaving the source in place) when the file cannot be processed.
export async function processVideo(target: ProcessingTarget): Promise<ProcessedVideo> {
  const TAG = 'video-processing';
  const probe = await probeVideo(target.sourcePath);
  const plan = planFor(probe, target.sourceMimeType);
  const mimeType = plan === 'keep-webm' ? 'video/webm' : 'video/mp4';
  const outputPath = target.outputPathFor(mimeType);
  const tempPath = `${outputPath}.processing`;
  log(TAG, 'Processing video', { source: target.sourcePath, plan, probe });

  try {
    if (plan === 'keep-webm') {
      await fs.rename(target.sourcePath, outputPath);
    } else {
      const codecArgs =
        plan === 'remux-mp4'
          ? ['-c', 'copy']
          : [
              '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
              // Cap at 1920 wide, keep aspect, keep dimensions even for H.264
              '-vf', "scale='trunc(min(1920,iw)/2)*2':-2",
              '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
            ];
      await ffmpeg([
        '-i', target.sourcePath,
        '-map', '0:v:0', '-map', '0:a:0?',
        ...codecArgs,
        '-movflags', '+faststart',
        '-f', 'mp4', tempPath,
      ]);
      await fs.rename(tempPath, outputPath);
      await fs.unlink(target.sourcePath).catch(() => {});
    }
  } catch (error) {
    await fs.unlink(tempPath).catch(() => {});
    throw error;
  }

  // Poster: a frame 10% in (capped at 10s) so title cards and black lead-ins
  // are skipped. A poster failure is not a processing failure.
  const result = await probeVideo(outputPath);
  const seek = Math.min(result.durationSeconds * 0.1, 10);
  let poster = true;
  try {
    await ffmpeg([
      '-ss', seek.toFixed(2), '-i', outputPath,
      '-frames:v', '1', '-vf', "scale='min(640,iw)':-2", '-q:v', '3',
      '-f', 'image2', target.posterPath,
    ]);
  } catch (error) {
    poster = false;
    log(TAG, 'Poster extraction failed', { outputPath, error: (error as Error).message });
  }

  const { size } = await fs.stat(outputPath);
  return {
    mimeType,
    fileSize: size,
    width: result.video?.width ?? 0,
    height: result.video?.height ?? 0,
    durationSeconds: result.durationSeconds,
    videoCodec: result.video?.codec ?? '',
    audioCodec: result.audio?.codec ?? null,
    transcoded: plan === 'transcode-mp4',
    poster,
  };
}
