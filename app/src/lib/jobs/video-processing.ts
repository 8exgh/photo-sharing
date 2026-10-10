import { queryPendingVideoProcessing } from '../queries';
import { markVideoProcessed, markVideoProcessingFailed } from '../commands';
import { processVideo } from '../video-processing';
import { videoFilePath, videoPosterPath, videoSourcePath } from '../video-storage';
import { log, logError } from '../logger';

// Background job in the same query -> work -> command shape as the email job:
// uploads waiting for conversion are found by a query, ffmpeg does the work,
// and the outcome is recorded with a command so they stop showing up. A
// conversion that throws is recorded as failed rather than retried forever;
// the original upload keeps streaming in that case.
export async function runVideoProcessingJob(): Promise<void> {
  const TAG = 'jobs:video-processing';
  const pending = queryPendingVideoProcessing();
  if (pending.length === 0) return;

  log(TAG, 'Videos awaiting processing', { count: pending.length });

  for (const item of pending) {
    const started = Date.now();
    try {
      const result = await processVideo({
        sourcePath: videoSourcePath(item.tenantId, item.videoId, item.file.sourceMimeType),
        sourceMimeType: item.file.sourceMimeType,
        outputPathFor: (mimeType) => videoFilePath(item.tenantId, item.videoId, mimeType),
        posterPath: videoPosterPath(item.tenantId, item.videoId),
      });
      markVideoProcessed(item.tenantId, item.videoId, result);
      log(TAG, 'Video processed', { tenantId: item.tenantId, videoId: item.videoId, ms: Date.now() - started, transcoded: result.transcoded });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logError(TAG, `Video processing failed for ${item.videoId}`, error);
      markVideoProcessingFailed(item.tenantId, item.videoId, message);
    }
  }
}
