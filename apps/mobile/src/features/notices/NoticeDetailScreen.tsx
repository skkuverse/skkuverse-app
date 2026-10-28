import { View, ScrollView, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { BookmarkSimpleIcon } from 'phosphor-react-native';
import {
  useT,
  SdsRadius,
  SdsSpacing,
} from '@skkuverse/shared';
import { Button, FixedBottomCTA, Toast, Txt, useSemanticColors, createThemedStyles } from '@skkuverse/sds';
import { InlineBanner } from '@/features/ads/InlineBanner';
import { AdUnitIds } from '@/platform/ads';
import { ReviewPromptHost } from '@/features/feedback/ReviewPromptHost';
import { NoticeListSkeleton } from './NoticeListSkeleton';
import { NoticeEmptyState } from './NoticeEmptyState';
import { SummaryCard } from './SummaryCard';
import { DeletedNoticeTombstone } from './DeletedNoticeTombstone';
import { NoticeAttachments } from './components/NoticeAttachments';
import { NoticeContentRefs } from './components/NoticeContentRefs';
import { NoticeBodyDivider } from './components/NoticeBodyDivider';
import { NoticeScreenView } from './components/NoticeScreenView';
import { NoticeSiblingNav } from './components/NoticeSiblingNav';
import { NoticeSourceSheet } from './components/NoticeSourceSheet';
import { useNoticeDetailHeaderOptions } from './components/useNoticeDetailHeaderOptions';
import { formatDisplayDate } from './notice-date.rules';
import { useNoticeDetailScreen } from './useNoticeDetailScreen';

interface Props {
  sourceId: string;
  articleNo: number;
  source?: string;
}

export function NoticeDetailScreen({ sourceId, articleNo, source }: Props) {
  const styles = useStyles();
  const { t, tpl } = useT();
  const color = useSemanticColors();
  const { sourceSheetRef, ...vm } = useNoticeDetailScreen({
    sourceId,
    articleNo,
    source,
    reviewIcon: <BookmarkSimpleIcon size={32} color={color.fg.brandContrast} weight="fill" />,
  });
  const headerOptions = useNoticeDetailHeaderOptions({
    tombstone: vm.status === 'deleted',
    saved: vm.saved,
    onSave: vm.onSave,
    onShare: vm.onShare,
  });

  const barAction = vm.status === 'ready' ? (vm.screen?.action ?? null) : null;

  // WHY: one Stack.Screen at a stable position, so the loading, error and success branches never
  // unregister and re-register the header.
  return (
    <View style={styles.container}>
      <Stack.Screen options={headerOptions} />
      {vm.status === 'loading' ? (
        <NoticeListSkeleton />
      ) : vm.status === 'deleted' ? (
        <DeletedNoticeTombstone
          entry={vm.entry}
          onRemove={vm.onRemoveBookmark}
          isRemoving={vm.isRemoving}
        />
      ) : vm.status === 'error' ? (
        <NoticeEmptyState message={t('notices.error')} onRetry={vm.onRetry} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Txt typography="t9" fontWeight="bold" color="neutral" style={styles.title}>
            {vm.notice.title}
          </Txt>

          {vm.screen ? (
            <View style={styles.screen}>
              <NoticeScreenView
                notice={vm.notice}
                screen={vm.screen}
                boardName={vm.boardName}
                contentRefs={vm.contentRefs}
                onLinePress={vm.onLinePress}
                onLineAction={vm.onLineAction}
                openSourceSheet={vm.openSourceSheet}
                onAttachmentPreview={vm.onAttachmentPreview}
                onAttachmentDownload={vm.onAttachmentDownload}
                onCopy={vm.onCopy}
              />
            </View>
          ) : (
            <>
              <View style={styles.metaRow}>
                <Txt typography="t5" color="neutralSubtle">
                  {formatDisplayDate(vm.notice.date)}
                </Txt>
                {vm.notice.author ? (
                  <>
                    <Dot />
                    <Txt typography="t5" color="neutralSubtle">
                      {vm.notice.author}
                    </Txt>
                  </>
                ) : null}
                {vm.notice.views > 0 ? (
                  <>
                    <Dot />
                    <Txt typography="t5" color="neutralSubtle">
                      {tpl('notices.views', vm.notice.views)}
                    </Txt>
                  </>
                ) : null}
              </View>

              {vm.notice.summary ? (
                <SummaryCard
                  summary={vm.notice.summary}
                  sourceId={sourceId}
                  articleNo={articleNo}
                />
              ) : null}

              <NoticeContentRefs
                images={vm.contentRefs.images}
                links={vm.contentRefs.links}
                emails={vm.contentRefs.emails}
                phones={vm.contentRefs.phones}
                sourceUrl={vm.notice.sourceUrl}
                onImagePress={vm.openSourceSheet}
                onCopyContact={vm.onCopy}
              />

              <NoticeAttachments
                attachments={vm.notice.attachments}
                sourceUrl={vm.notice.sourceUrl}
                onPreview={vm.onAttachmentPreview}
                onDownload={vm.onAttachmentDownload}
              />

              {vm.notice.contentMarkdown ? (
                <NoticeBodyDivider onPress={vm.openSourceSheet} />
              ) : (
                <View style={styles.sectionBreak} />
              )}
            </>
          )}

          {/* WHY: the ad sits after the content and before the sibling nav, which every reader passes on the
              way to the next notice. maxHeight reserves the slot, since a late load pushing a button is a misclick. */}
          <InlineBanner unitId={AdUnitIds.noticeDetailBanner} maxHeight={250} />

          <NoticeSiblingNav sourceId={sourceId} articleNo={articleNo} />
        </ScrollView>
      )}
      {barAction ? (
        <FixedBottomCTA>
          <Button tone="brand" size="large" display="block" onPress={() => vm.onBarAction(barAction.action)}>
            {barAction.label}
          </Button>
        </FixedBottomCTA>
      ) : null}
      <NoticeSourceSheet
        ref={sourceSheetRef}
        markdown={vm.sourceMarkdown}
        sourceUrl={vm.sourceUrl}
        onCopyText={vm.onCopy}
        onOpenOriginal={vm.openOriginal}
        onClose={vm.closeSourceSheet}
      />
      <Toast
        open={vm.toastText !== null}
        text={vm.toastText ?? ''}
        icon={<Toast.Icon type="check" />}
        onClose={vm.onToastClose}
      />
      <ReviewPromptHost {...vm.reviewHost} />
    </View>
  );
}

function Dot() {
  const styles = useStyles();
  return <View style={styles.dot} />;
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
  scroll: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingVertical: SdsSpacing.x4,
    paddingBottom: SdsSpacing.x8,
    gap: SdsSpacing.x2,
  },
  title: {
    marginTop: SdsSpacing.x1_5,
  },
  screen: {
    marginTop: SdsSpacing.x1,
    marginBottom: SdsSpacing.x6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x1_5,
    marginTop: SdsSpacing.x1,
    flexWrap: 'wrap',
  },
  dot: {
    width: 2,
    height: 2,
    borderRadius: SdsRadius.full,
    backgroundColor: color.stroke.control,
  },
  // WHY: drawn only when there is no markdown body, since the 'read more' button otherwise marks the boundary.
  sectionBreak: {
    marginTop: SdsSpacing.x6,
    marginBottom: SdsSpacing.x4,
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.stroke.neutralMuted,
  },
}));
