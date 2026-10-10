import { runVerificationEmailJob } from './jobs/verification-emails';
import { runVideoProcessingJob } from './jobs/video-processing';
import { log, logError } from './logger';

// In-process background processor, modelled on inventory-shopify's job loop:
// each job discovers work via queries and completes it via commands. This app
// deploys as a single container, so the loops run inside the Next.js server
// (started from instrumentation.ts) instead of a separate processor container.
//
// Each job gets its own loop. A loop only reschedules itself after the job
// returns, so a job never overlaps with itself, but a slow job (an hour-long
// transcode) does not hold up the others: verification emails keep flowing
// while a video converts.
let started = false;

function getPollingIntervalMs(): number {
  return parseInt(process.env.POLLING_INTERVAL_MS || '5000', 10);
}

function startJobLoop(name: string, job: () => Promise<void>, intervalMs: number): void {
  const cycle = async () => {
    try {
      await job();
    } catch (error) {
      logError('Processor', `${name} job cycle error`, error);
    }
    setTimeout(cycle, intervalMs);
  };
  setTimeout(cycle, intervalMs);
}

export function startBackgroundProcessor(): void {
  if (started) return;
  started = true;

  const intervalMs = getPollingIntervalMs();
  log('Processor', 'Background processor starting', { intervalMs, jobs: ['verification-emails', 'video-processing'] });

  startJobLoop('verification-emails', runVerificationEmailJob, intervalMs);
  startJobLoop('video-processing', runVideoProcessingJob, intervalMs);
}
