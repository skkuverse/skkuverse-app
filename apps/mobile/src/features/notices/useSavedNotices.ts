import { useEffect, useMemo } from 'react';
import { useRouter } from 'expo-router';
import {
  bookmarkKey,
  useAuthStore,
  useT,
  type BookmarkEntry,
} from '@skkuverse/shared';
import { logBookmarksListOpen } from '@/platform/analytics';
import { useBookmarks } from './useBookmarks';
import type { NoticeListItem } from './notices.types';

export function useSavedNotices() {
  const { t } = useT();
  const router = useRouter();
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const { list } = useBookmarks();

  useEffect(() => {
    logBookmarksListOpen();
  }, []);

  const items = useMemo(() => list.map(bookmarkToListItem), [list]);

  return { t, router, isAnonymous, items };
}

/** WHY: a summary is synthesized only with a cached `summaryType`; without one the row would show a wrong D-day. */
function bookmarkToListItem(entry: BookmarkEntry): NoticeListItem {
  return {
    id: bookmarkKey(entry.sourceId, entry.articleNo),
    sourceId: entry.sourceId,
    articleNo: entry.articleNo,
    title: entry.title,
    category: null,
    author: null,
    department: entry.department,
    date: entry.date,
    views: 0,
    sourceUrl: entry.sourceUrl,
    hasContent: entry.hasContent,
    hasAttachments: entry.hasAttachments,
    isEdited: false,
    summary: entry.summaryType
      ? {
          oneLiner: entry.summaryOneLiner,
          type: entry.summaryType,
          startAt: null,
          endAt: null,
        }
      : null,
    row: null,
  };
}
