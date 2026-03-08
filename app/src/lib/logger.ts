/**
 * Simple JSON logging helper for consistent logging across the application.
 * Outputs to stdout/stderr with timestamps and IP addresses.
 * Also maintains an in-memory ring buffer for the admin log viewer.
 */

export interface LogEntry {
  id: number;
  ts: string;
  level: 'info' | 'error';
  tag: string;
  msg: string;
  data?: Record<string, unknown>;
}

const MAX_LOG_ENTRIES = 1000;
const logBuffer: LogEntry[] = [];
let logIdCounter = 0;

function pushEntry(level: 'info' | 'error', tag: string, msg: string, data?: Record<string, unknown>): void {
  logIdCounter++;
  logBuffer.push({ id: logIdCounter, ts: new Date().toISOString(), level, tag, msg, data });
  if (logBuffer.length > MAX_LOG_ENTRIES) {
    logBuffer.splice(0, logBuffer.length - MAX_LOG_ENTRIES);
  }
}

export function getLogEntries(afterId = 0): LogEntry[] {
  if (afterId === 0) return [...logBuffer];
  const idx = logBuffer.findIndex(e => e.id > afterId);
  if (idx === -1) return [];
  return logBuffer.slice(idx);
}

export function getClientIP(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const xri = request.headers.get('x-real-ip');
  if (xri) return xri;
  return 'unknown';
}

export function log(tag: string, msg: string, data?: object): void {
  const entry = { ts: new Date().toISOString(), tag, msg, ...data };
  console.log(JSON.stringify(entry));
  pushEntry('info', tag, msg, data as Record<string, unknown>);
}

export function logError(tag: string, msg: string, error: unknown): void {
  const errMsg = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(JSON.stringify({ ts: new Date().toISOString(), tag, msg, error: errMsg, stack }));
  pushEntry('error', tag, msg, { error: errMsg, stack });
}

export function logRequest(tag: string, request: Request, extra?: object): void {
  const ip = getClientIP(request);
  const data = { ip, method: request.method, url: request.url, ...extra };
  console.log(JSON.stringify({ ts: new Date().toISOString(), tag, ...data }));
  pushEntry('info', tag, 'request', data as Record<string, unknown>);
}
