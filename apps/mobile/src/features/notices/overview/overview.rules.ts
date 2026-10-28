import type { AppFailure } from '@skkuverse/shared';
import type { NoticeOverviewResult, OverviewReason } from './overview.types';

export type OverviewOutcome =
  | 'answer'
  | OverviewReason
  | 'rate_limited'
  | 'network'
  | 'server'
  | 'parse'
  | 'cancelled';

export function overviewOutcome(
  data: NoticeOverviewResult | undefined,
  error: AppFailure | null,
): OverviewOutcome | null {
  if (error) {
    if (error.type === 'server') return error.statusCode === 429 ? 'rate_limited' : 'server';
    return error.type;
  }
  if (!data) return null;
  if (data.overview) return 'answer';
  return data.reason ?? 'unavailable';
}

// CONTRACT(skkuverse-server): skkuverse-server/src/notices/notices.rules.ts (`toSearchQuery`, `toSourceIds`) is
// mirrored here, so the app never sends a request the server would answer with a 400.
const MAX_QUERY_CODEPOINTS = 100;
const MAX_SOURCE_IDS = 20;

function hasControlChar(s: string): boolean {
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < 32 || cp === 127) return true;
  }
  return false;
}

/** WHY: the query length counts Unicode codepoints, not UTF-16 units, as the server does. */
export function canRequestOverview(q: string, sourceIds: readonly string[]): boolean {
  const trimmed = q.trim();
  const length = [...trimmed].length;
  if (length === 0 || length > MAX_QUERY_CODEPOINTS) return false;
  if (hasControlChar(trimmed)) return false;
  return sourceIds.length >= 1 && sourceIds.length <= MAX_SOURCE_IDS;
}

/** CONTRACT(skkuverse-server): skkuverse-server/src/notices/overview/notices-overview.rules.ts normalizes so. */
export function normalizeOverviewQuery(q: string): string {
  return q.trim().replace(/\s+/g, ' ').toLowerCase();
}
