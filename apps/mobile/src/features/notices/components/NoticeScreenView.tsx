import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinkIcon, PaperclipIcon, SparkleIcon } from 'phosphor-react-native';
import { useT, SdsSpacing, type BgColorName, type FgColorName, type TranslationKey } from '@skkuverse/shared';
import { Badge, Callout, Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import type { ContentRefs } from '../content-refs.rules';
import type {
  NoticeAction,
  NoticeScreen,
  NoticeScreenCollapse,
  NoticeScreenLine,
  NoticeScreenStatusTone,
} from '../notice-facts.types';
import { toActionUrls, toOriginalAttachments, toOriginalLinks } from '../notice-screen.rules';
import type { NoticeAttachment, NoticeDetail } from '../notices.types';
import { NoticeAttachments } from './NoticeAttachments';
import { NoticeBodyDivider } from './NoticeBodyDivider';
import { NoticeContentRefs } from './NoticeContentRefs';
import { NoticeScreenBlocks } from './NoticeScreenBlocks';

interface Props {
  notice: NoticeDetail;
  screen: NoticeScreen;
  boardName: string | null;
  contentRefs: ContentRefs;
  onLinePress: (line: NoticeScreenLine) => void;
  onLineAction: (action: NoticeAction) => void;
  openSourceSheet: () => void;
  onAttachmentPreview: (attachment: NoticeAttachment) => void;
  onAttachmentDownload: (attachment: NoticeAttachment) => void;
  onCopy: (text: string) => void;
}

const STATUS_TONE: Record<NoticeScreenStatusTone, { fg: FgColorName; bg: BgColorName }> = {
  open: { fg: 'brandContrast', bg: 'brandWeak' },
  soon: { fg: 'criticalContrast', bg: 'criticalWeak' },
  closed: { fg: 'neutralSubtle', bg: 'neutralWeak' },
  stopped: { fg: 'warningContrast', bg: 'warningWeak' },
  neutral: { fg: 'neutral', bg: 'neutralWeak' },
};

const COLLAPSED_COPY: Record<NoticeScreenCollapse, TranslationKey> = {
  closed: 'notices.screen.collapsedClosed',
  cancelled: 'notices.screen.collapsedCancelled',
};

export function NoticeScreenView({
  notice,
  screen,
  boardName,
  contentRefs,
  onLinePress,
  onLineAction,
  openSourceSheet,
  onAttachmentPreview,
  onAttachmentDownload,
  onCopy,
}: Props) {
  const styles = useStyles();
  const color = useSemanticColors();
  const { t, tpl } = useT();
  const [isExpanded, setIsExpanded] = useState(false);
  const links = useMemo(
    () => toOriginalLinks(screen.original.links, [...contentRefs.links.map((link) => link.url), ...toActionUrls(screen)]),
    [screen, contentRefs.links],
  );
  const attachments = useMemo(
    () => toOriginalAttachments(screen.original.attachments, notice.attachments),
    [screen.original.attachments, notice.attachments],
  );
  const posters = contentRefs.images.slice(0, screen.original.posterCount);
  const headerParts = [boardName, screen.firstSeen].filter((part) => part !== null);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        {headerParts.length > 0 ? (
          <Txt typography="t5" color="neutralSubtle">
            {headerParts.join(' · ')}
          </Txt>
        ) : null}
        {screen.change ? (
          <Txt typography="t4" color="informativeContrast">
            {tpl('notices.screen.change', screen.change.what, screen.change.before, screen.change.after)}
          </Txt>
        ) : null}
      </View>

      {screen.status ? (
        <View style={styles.inline}>
          <Badge size="small" color={STATUS_TONE[screen.status.tone].fg} backgroundColor={STATUS_TONE[screen.status.tone].bg}>
            {screen.status.word}
          </Badge>
          {screen.status.detail !== null ? (
            <Txt typography="t5" fontWeight="semibold" color="neutral">
              {screen.status.detail}
            </Txt>
          ) : null}
        </View>
      ) : null}

      {screen.isStaffOnly ? (
        <Callout tone="neutral" description={t('notices.screen.staffOnly')} />
      ) : (
        <View style={styles.inline}>
          <SparkleIcon size={14} color={color.fg.ai} weight="fill" />
          <Txt typography="t2" color="ai" style={styles.shrink}>
            {t(screen.isPosterOnly ? 'notices.screen.sourceLinePoster' : 'notices.screen.sourceLine')}
          </Txt>
        </View>
      )}

      {screen.blocks.length > 0 ? (
        screen.collapsed !== null && !isExpanded ? (
          <Callout
            tone="neutral"
            description={t(COLLAPSED_COPY[screen.collapsed])}
            linkProps={{ children: t('notices.screen.expand'), onPress: () => setIsExpanded(true) }}
          />
        ) : (
          <NoticeScreenBlocks
            blocks={screen.blocks}
            onLinePress={onLinePress}
            onLineAction={onLineAction}
            onFooterLink={openSourceSheet}
          />
        )
      ) : null}

      <View style={styles.original}>
        <Txt typography="t3" fontWeight="bold" color="neutralSubtle">
          {t('notices.screen.original')}
        </Txt>
        <NoticeContentRefs
          images={posters}
          links={links.linked}
          emails={[]}
          phones={[]}
          sourceUrl={notice.sourceUrl}
          onImagePress={openSourceSheet}
          onCopyContact={onCopy}
        />
        {links.unlinked.map((link) => (
          <View key={`${link.role}:${link.domain}`} style={styles.inline}>
            <LinkIcon size={16} color={color.fg.neutralSubtle} weight="fill" />
            <Txt typography="t4" fontWeight="semibold" color="neutral">
              {link.role}
            </Txt>
            <Txt typography="t3" color="neutralSubtle" numberOfLines={1} style={styles.shrink}>
              {link.domain}
            </Txt>
          </View>
        ))}
        <NoticeAttachments
          attachments={attachments.files}
          roleByUrl={attachments.roleByUrl}
          sourceUrl={notice.sourceUrl}
          onPreview={onAttachmentPreview}
          onDownload={onAttachmentDownload}
        />
        {attachments.unmatched.map((file) => (
          <View key={`${file.role}:${file.name}`} style={styles.inline}>
            <PaperclipIcon size={16} color={color.fg.neutralSubtle} weight="fill" />
            <Txt typography="t4" fontWeight="semibold" color="neutral">
              {file.role}
            </Txt>
            <Txt typography="t3" color="neutralSubtle" numberOfLines={1} style={styles.shrink}>
              {file.name}
            </Txt>
          </View>
        ))}
        {notice.contentMarkdown ? <NoticeBodyDivider onPress={openSourceSheet} /> : null}
      </View>
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  wrap: {
    gap: SdsSpacing.x5,
  },
  header: {
    gap: SdsSpacing.x1_5,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SdsSpacing.x1_5,
  },
  shrink: {
    flexShrink: 1,
  },
  original: {
    gap: SdsSpacing.x2_5,
    paddingTop: SdsSpacing.x4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.stroke.neutralMuted,
  },
}));
