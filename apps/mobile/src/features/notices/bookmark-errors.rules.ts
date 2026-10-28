/**
 * WHY: a permanent error (rules, malformed data, missing index, App Check as permission-denied or
 * unauthenticated) reverts; anything unrecognized is transient, since a wrong revert is worse.
 */

const PERMANENT_CODES = new Set([
  'permission-denied',
  'invalid-argument',
  'failed-precondition',
  'unauthenticated',
]);

export function classifyBookmarkToggleError(
  err: unknown,
): 'permanent' | 'transient' {
  if (!err || typeof err !== 'object') return 'transient';
  const code = (err as { code?: unknown }).code;
  if (typeof code !== 'string') return 'transient';
  const last = code.includes('/') ? code.slice(code.lastIndexOf('/') + 1) : code;
  return PERMANENT_CODES.has(last) ? 'permanent' : 'transient';
}
