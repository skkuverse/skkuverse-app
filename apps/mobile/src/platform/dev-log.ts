import { createMMKV } from 'react-native-mmkv';

/**
 * WHY: MMKV, not AsyncStorage: a sync load at module scope has no hydrate race that could overwrite the
 * cold-start entry this buffer exists to keep. RELEASE-GATE(debug-menu): remove its settings entry before
 * an App Store release.
 */

const mmkv = createMMKV({ id: 'skkubus-debug' });
const KEY = 'dev-log:notif';
const MAX = 500;

type LogEntry = { ts: string; tag: string; data: unknown };

function loadFromDisk(): LogEntry[] {
  try {
    const raw = mmkv.getString(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LogEntry[]) : [];
  } catch {
    return [];
  }
}

let buf: LogEntry[] = loadFromDisk();

/** WHY: ids and data keys only, never an FCM token, a user id or an auth token: share and copy export it verbatim. */
export function devLog(tag: string, data?: unknown): void {
  const entry: LogEntry = { ts: new Date().toISOString(), tag, data };
  buf.push(entry);
  if (buf.length > MAX) buf = buf.slice(-MAX);
  try {
    mmkv.set(KEY, JSON.stringify(buf));
  } catch {
    // WHY: persistence is best-effort; the entry stays in memory.
  }
  if (__DEV__) {
    console.log(`[${tag}]`, data);
  }
}

export function getDevLogs(): LogEntry[] {
  return buf.slice();
}

export function clearDevLogs(): void {
  buf = [];
  try {
    mmkv.remove(KEY);
  } catch {
    // WHY: best-effort; the in-memory buffer is already cleared.
  }
}

export function formatLogsForShare(): string {
  return buf
    .map((e) => `[${e.ts}] ${e.tag}\n${JSON.stringify(e.data, null, 2)}`)
    .join('\n\n');
}
