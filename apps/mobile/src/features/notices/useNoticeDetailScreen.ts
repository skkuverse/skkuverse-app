import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { useT } from '@skkuverse/shared';
import { useSemanticColors, type SheetRef } from '@skkuverse/sds';
import { logNoticeView, logNoticesContentSelect } from '@/platform/analytics';
import { openExternalUrl, openInAppBrowser, shareContent } from '@/platform/handoff';
import { useReviewPrompt } from '@/features/feedback/useReviewPrompt';
import { THREE_DAYS_MS } from '@/features/feedback/feedback.constants';
import { useBookmark } from './useBookmark';
import { useNoticeDetail } from './useNoticeDetail';
import { extractContentRefs } from './content-refs.rules';
import { buildAttachmentUrl, canPreview } from './attachment.rules';
import { decideNoticeDetailState } from './notice-detail.rules';
import type { NoticeAttachment } from './notices.types';

const inAppBrowserOptions: WebBrowser.WebBrowserOpenOptions = {
  presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  dismissButtonStyle: 'close',
  showTitle: true,
  enableBarCollapsing: true,
};

interface UseNoticeDetailScreenInputs {
  sourceId: string;
  articleNo: number;
  reviewIcon: ReactNode;
}

export function useNoticeDetailScreen({ sourceId, articleNo, reviewIcon }: UseNoticeDetailScreenInputs) {
  const { t } = useT();
  const color = useSemanticColors();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useNoticeDetail(sourceId, articleNo);
  const [toastText, setToastText] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const review = useReviewPrompt({
    reason: 'second_bookmark',
    minInstallAgeMs: THREE_DAYS_MS,
    title: t('feedback.reviewPrompt.bookmarkTitle'),
    icon: reviewIcon,
    resolveContext: () => ({ sourceId, articleNo }),
  });

  const {
    isSaved: saved,
    entry: bookmarkEntry,
    toggle: toggleBookmark,
    unsave: unsaveBookmark,
    refreshSummaryIfNewlyAvailable,
  } = useBookmark(sourceId, articleNo, {
    onReviewEligible: review.triggerIfEligible,
  });

  const state = decideNoticeDetailState({ isLoading, isError, error, data, bookmark: bookmarkEntry });

  const onRemoveBookmark = useCallback(() => {
    setIsRemoving(true);
    void unsaveBookmark().then((outcome) => {
      setIsRemoving(false);
      if (outcome === 'removed') {
        router.back();
      } else if (outcome === 'auth-required') {
        setToastText(t('notices.authRequired'));
        router.push('/login');
      } else {
        setToastText(t('notices.saveFailed'));
      }
    });
  }, [unsaveBookmark, router, t]);

  // WHY: heals a bookmark saved before the server summarized the notice; a no-op otherwise.
  useEffect(() => {
    if (data) void refreshSummaryIfNewlyAvailable(data);
  }, [data, refreshSummaryIfNewlyAvailable]);

  // WHY: keyed on (id, summary type), so a background refetch does not log a second view.
  useEffect(() => {
    if (!data) return;
    logNoticeView({
      sourceId,
      articleNo,
      hasSummary: data.summary != null,
      summaryType: data.summary?.type,
    });
  }, [sourceId, articleNo, data?.summary?.type]); // eslint-disable-line react-hooks/exhaustive-deps -- one view per notice and summary type, not per refetch (comment above)

  // QUIRK(ios): a new `data` reference would rebuild the header options, and react-native-screens
  // re-applying the bar items is the window in which UIBarButtonItem flashes its title. Read at call time.
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const onCopy = useCallback((text: string) => {
    void Clipboard.setStringAsync(text);
    setToastText(t('notices.copied'));
  }, [t]);

  const contentRefs = useMemo(
    () =>
      extractContentRefs(
        data?.contentMarkdown,
        data?.attachments.map((a) => a.url) ?? [],
      ),
    [data?.contentMarkdown, data?.attachments],
  );

  const sourceSheetRef = useRef<SheetRef>(null);
  const openSourceSheet = useCallback(() => {
    const current = dataRef.current;
    if (current) {
      logNoticesContentSelect({
        content_type: 'detail_view_source',
        item_id: `${current.sourceId}/${current.articleNo}`,
      });
    }
    sourceSheetRef.current?.present?.();
  }, []);

  const closeSourceSheet = useCallback(() => {
    sourceSheetRef.current?.dismiss?.();
  }, []);

  // WHY: the external browser, not the in-app shell: this opens from inside the source sheet, and a
  // router.push from there lands behind the sheet, so nothing seems to happen.
  const sourceUrl = data?.sourceUrl;
  const openOriginal = useCallback(() => {
    const current = dataRef.current;
    if (current) {
      logNoticesContentSelect({
        content_type: 'detail_open_original',
        item_id: `${current.sourceId}/${current.articleNo}`,
      });
    }
    if (!sourceUrl) return;
    void openExternalUrl(sourceUrl);
  }, [sourceUrl]);

  const openAttachment = useCallback(
    (url: string, mode: 'inline' | 'download', name?: string) => {
      const proxyUrl = buildAttachmentUrl(url, sourceUrl ?? '', mode, name);
      void openInAppBrowser(proxyUrl, {
        ...inAppBrowserOptions,
        controlsColor: color.fg.brand,
        toolbarColor: color.bg.layerDefault,
      });
    },
    [sourceUrl, color],
  );

  const onAttachmentPreview = useCallback(
    (a: NoticeAttachment) => {
      const previewable = canPreview(a.name);
      logNoticesContentSelect({
        content_type: previewable
          ? 'detail_attachment_preview'
          : 'detail_attachment_download',
        item_id: a.name,
      });
      // WHY: the in-app browser cannot draw hwp, doc or zip, so those go straight to download.
      openAttachment(a.url, previewable ? 'inline' : 'download', a.name);
    },
    [openAttachment],
  );

  const onAttachmentDownload = useCallback(
    (a: NoticeAttachment) => {
      logNoticesContentSelect({
        content_type: 'detail_attachment_download',
        item_id: a.name,
      });
      openAttachment(a.url, 'download', a.name);
    },
    [openAttachment],
  );

  const onSave = useCallback(() => {
    const current = dataRef.current;
    if (!current) return;
    void toggleBookmark(current).then((outcome) => {
      if (outcome === 'auth-required') {
        setToastText(t('notices.authRequired'));
        router.push('/login');
      } else if (outcome === 'failed') {
        setToastText(t('notices.saveFailed'));
      }
    });
  }, [toggleBookmark, t, router]);

  const onShare = useCallback(() => {
    const current = dataRef.current;
    if (!current) return;
    logNoticesContentSelect({
      content_type: 'detail_share',
      item_id: `${current.sourceId}/${current.articleNo}`,
    });
    // QUIRK(ios): the share sheet appends `url` to a Messages text itself, so `message` carries only the title.
    // QUIRK(android): ACTION_SEND ignores `url`, so the URL goes inside `message`.
    const noticeUrl = `https://skkuverse.com/p/notices/${current.sourceId}/${current.articleNo}`;
    void shareContent(
      Platform.OS === 'ios'
        ? { url: noticeUrl, message: current.title }
        : { message: `${current.title}\n${noticeUrl}` },
    );
  }, []);

  return {
    ...state,
    saved,
    isRemoving,
    contentRefs,
    sourceMarkdown: data?.contentMarkdown ?? null,
    sourceUrl,
    sourceSheetRef,
    toastText,
    reviewHost: review.host,
    onRetry: refetch,
    onRemoveBookmark,
    onSave,
    onShare,
    onCopy,
    openSourceSheet,
    closeSourceSheet,
    openOriginal,
    onAttachmentPreview,
    onAttachmentDownload,
    onToastClose: () => setToastText(null),
  };
}
