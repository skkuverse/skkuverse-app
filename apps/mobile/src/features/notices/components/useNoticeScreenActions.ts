import { useCallback } from 'react';
import { Platform } from 'react-native';
import { openMapPlace } from '@/features/web/web.service';
import { logNoticesContentSelect } from '@/platform/analytics';
import { openExternalUrl } from '@/platform/handoff';
import { NOTICE_ACTION_CONTENT_TYPE, toActionHandoff } from '../notice-action.rules';
import type { NoticeAction, NoticeScreenLine } from '../notice-facts.types';

interface UseNoticeScreenActionsInputs {
  sourceId: string;
  articleNo: number;
  onCopy: (text: string) => void;
  openQuote: (quote: string | null) => void;
}

export function useNoticeScreenActions({ sourceId, articleNo, onCopy, openQuote }: UseNoticeScreenActionsInputs) {
  const itemId = `${sourceId}/${articleNo}`;

  const runAction = useCallback(
    (action: NoticeAction) => {
      const handoff = toActionHandoff(action, Platform.OS === 'ios' ? 'ios' : 'android');
      if (handoff.via === 'map') {
        const place = handoff.space === null ? handoff.place : { ...handoff.place, highlightSpaceCd: handoff.space };
        openMapPlace(place, 'notice', {
          href: '/notices/[sourceId]/[articleNo]',
          params: { sourceId, articleNo: String(articleNo) },
        });
        return;
      }
      const { url, copyOnFailure } = handoff;
      openExternalUrl(url).catch(() => {
        if (copyOnFailure !== null) onCopy(copyOnFailure);
      });
    },
    [sourceId, articleNo, onCopy],
  );

  const onLineAction = useCallback(
    (action: NoticeAction) => {
      logNoticesContentSelect({ content_type: NOTICE_ACTION_CONTENT_TYPE[action.kind], item_id: itemId });
      runAction(action);
    },
    [itemId, runAction],
  );

  const onBarAction = useCallback(
    (action: NoticeAction) => {
      logNoticesContentSelect({ content_type: 'detail_cta', item_id: itemId });
      runAction(action);
    },
    [itemId, runAction],
  );

  const onLinePress = useCallback(
    (line: NoticeScreenLine) => {
      logNoticesContentSelect({ content_type: 'detail_line_quote', item_id: itemId });
      // WHY: a quote from the title is not in the body, so the body opens at its top rather than as not found.
      openQuote(line.source === 'title' ? null : line.quote);
    },
    [itemId, openQuote],
  );

  return { onLineAction, onBarAction, onLinePress };
}
