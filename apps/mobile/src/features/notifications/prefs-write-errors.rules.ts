/**
 * QUIRK(firebase): an update on a missing document fails with permission-denied, never not-found, so
 * narrowing this to not-found kills the self-heal; a real rules denial costs one wasted seed. Transient
 * codes stay out: the offline queue flushes them, and a seed there makes documents nobody needed.
 */

const RECOVERABLE_CODES = new Set(['permission-denied', 'not-found']);

export function isMissingPrefsDocError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: unknown }).code;
  if (typeof code !== 'string') return false;
  const last = code.includes('/') ? code.slice(code.lastIndexOf('/') + 1) : code;
  return RECOVERABLE_CODES.has(last);
}
