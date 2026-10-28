import { useMemo } from 'react';
import { useBookmarkStore, type BookmarkEntry } from '@skkuverse/shared';

/** WHY: re-sorts in the listener's order, which optimistic writes bypass. */
export function useBookmarks(): { list: BookmarkEntry[]; loaded: boolean } {
  const entries = useBookmarkStore((s) => s.entries);
  const loaded = useBookmarkStore((s) => s.loaded);

  const list = useMemo(() => Object.values(entries).sort(compareEntries), [entries]);

  return { list, loaded };
}

function compareEntries(a: BookmarkEntry, b: BookmarkEntry): number {
  const aMs = toMillis(a.savedAt);
  const bMs = toMillis(b.savedAt);
  if (aMs !== bMs) return bMs - aMs;
  return b.articleNo - a.articleNo;
}

/** WHY: an optimistic `serverTimestamp()` has no client time, so it sorts first until the listener echoes it. */
function toMillis(savedAt: BookmarkEntry['savedAt']): number {
  if (savedAt && typeof savedAt === 'object' && 'toMillis' in savedAt) {
    return (savedAt as { toMillis: () => number }).toMillis();
  }
  return Number.MAX_SAFE_INTEGER;
}
