/**
 * Simple JSON logging helper for consistent logging across the application.
 * Outputs to stdout/stderr with timestamps and IP addresses.
 */

export function getClientIP(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const xri = request.headers.get('x-real-ip');
  if (xri) return xri;
  return 'unknown';
}

export function log(tag: string, msg: string, data?: object): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), tag, msg, ...data }));
}

export function logError(tag: string, msg: string, error: unknown): void {
  const errMsg = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(JSON.stringify({ ts: new Date().toISOString(), tag, msg, error: errMsg, stack }));
}

export function logRequest(tag: string, request: Request, extra?: object): void {
  const ip = getClientIP(request);
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    tag,
    ip,
    method: request.method,
    url: request.url,
    ...extra
  }));
}
