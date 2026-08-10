import { runVerificationEmailJob } from './jobs/verification-emails';
import { log, logError } from './logger';

// In-process background processor, modelled on inventory-shopify's job loop:
// each cycle runs every job; jobs discover work via queries and complete it
// via commands. This app deploys as a single container, so the loop runs
// inside the Next.js server (started from instrumentation.ts) instead of a
// separate processor container.
let started = false;

function getPollingIntervalMs(): number {
  return parseInt(process.env.POLLING_INTERVAL_MS || '5000', 10);
}

export function startBackgroundProcessor(): void {
  if (started) return;
  started = true;

  const intervalMs = getPollingIntervalMs();
  log('Processor', 'Background processor starting', { intervalMs });

  const cycle = async () => {
    try {
      await runVerificationEmailJob();
    } catch (error) {
      logError('Processor', 'Job cycle error', error);
    }
    setTimeout(cycle, intervalMs);
  };

  setTimeout(cycle, intervalMs);
}
