// Next.js instrumentation hook — runs once when the server starts.
export async function register() {
  // Only in the real Node.js server, never during build or in edge runtime
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NEXT_PHASE !== 'phase-production-build') {
    const { startBackgroundProcessor } = await import('./lib/processor');
    startBackgroundProcessor();
  }
}
