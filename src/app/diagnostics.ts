/**
 * A small on-device error log, so a problem on a phone can be reported without developer tools:
 * Settings → About → Copy diagnostics. Stored in localStorage (never sent anywhere).
 */

const KEY = 'pos-errors';
const MAX = 20;

export interface LoggedError {
  at: number;
  source: string;
  message: string;
  stack?: string;
  path: string;
}

function read(): LoggedError[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as LoggedError[];
  } catch {
    return [];
  }
}

export function recordError(source: string, err: unknown): void {
  const e = err instanceof Error ? err : new Error(String(err));
  const entry: LoggedError = {
    at: Date.now(),
    source,
    message: e.message.slice(0, 500),
    stack: e.stack?.split('\n').slice(0, 6).join('\n'),
    path: location.pathname,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify([entry, ...read()].slice(0, MAX)));
  } catch {
    /* storage full or blocked: nothing more we can do */
  }
}

export function recentErrors(): LoggedError[] {
  return read();
}

export function clearErrors(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Call once at startup. */
export function installErrorLogging(): void {
  window.addEventListener('error', (e) => recordError('window', e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => recordError('promise', e.reason));
}

/** Plain-text report for bug reports (no personal data: no task titles, names or notes). */
export function diagnosticsReport(): string {
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches;
  const lines = [
    `Personal OS ${__APP_VERSION__}`,
    `Browser: ${navigator.userAgent}`,
    `Screen: ${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}x, ${standalone ? 'installed app' : 'browser tab'}`,
    `Service worker: ${navigator.serviceWorker?.controller ? 'active' : 'none'}`,
    `Online: ${navigator.onLine}`,
    '',
    'Recent errors:',
    ...(read().length
      ? read().map(
          (e) =>
            `- ${new Date(e.at).toISOString()} [${e.source}] ${e.path}: ${e.message}${e.stack ? `\n  ${e.stack.replace(/\n/g, '\n  ')}` : ''}`,
        )
      : ['(none)']),
  ];
  return lines.join('\n');
}
