import { useCallback, useState } from 'react';
import { Image, View } from 'react-native';
import {
  DownloadSimpleIcon,
  FileIcon,
  FilePdfIcon,
  FilePptIcon,
  FileXlsIcon,
  FileZipIcon,
  ImageIcon,
  PaperclipIcon,
} from 'phosphor-react-native';
import { SdsPalette, useT, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { Pressable, Txt, useResolvedScheme, useSemanticColors, createThemedStyles } from '@skkuverse/sds';
import type { BgColorName, FgColorName } from '@skkuverse/shared';
import {
  buildAttachmentUrl,
  canThumbnail,
  getAttachmentKind,
  getExtensionLabel,
  type AttachmentKind,
} from '../attachment.rules';
import type { NoticeAttachment } from '../notices.types';

interface Props {
  attachments: NoticeAttachment[];
  sourceUrl: string;
  onPreview: (attachment: NoticeAttachment) => void;
  onDownload: (attachment: NoticeAttachment) => void;
  /** WHY: a file the notice names by its role reads as that role, with its file name under it. */
  roleByUrl?: ReadonlyMap<string, string>;
}

/** WHY: the whole row previews and only download is a separate icon, so two text buttons stop outshouting the file name. */
export function NoticeAttachments({
  attachments,
  sourceUrl,
  onPreview,
  onDownload,
  roleByUrl,
}: Props) {
  const styles = useStyles();
  if (attachments.length === 0) return null;

  return (
    <View style={styles.list}>
      {attachments.map((a) => (
        <AttachmentRow
          key={a.url}
          attachment={a}
          role={roleByUrl?.get(a.url) ?? null}
          sourceUrl={sourceUrl}
          onPreview={onPreview}
          onDownload={onDownload}
        />
      ))}
    </View>
  );
}

function AttachmentRow({
  attachment,
  role,
  sourceUrl,
  onPreview,
  onDownload,
}: {
  attachment: NoticeAttachment;
  role: string | null;
  sourceUrl: string;
  onPreview: (a: NoticeAttachment) => void;
  onDownload: (a: NoticeAttachment) => void;
}) {
  const styles = useStyles();
  const color = useSemanticColors();
  // WHY: a thumbnail can fail (a host the proxy refuses, an expired gnuboard session, a non-image), so it falls back to the kind icon.
  const [thumbFailed, setThumbFailed] = useState(false);
  const { t } = useT();
  const kind = getAttachmentKind(attachment.name);
  const extLabel = getExtensionLabel(attachment.name);

  const showThumb = canThumbnail(attachment.name) && !thumbFailed;
  const handleThumbError = useCallback(() => setThumbFailed(true), []);

  return (
    <Pressable
      onPress={() => onPreview(attachment)}
      accessibilityRole="button"
      // WHY: there is no visual "Attachments" header, so the screen reader hears it on each row.
      accessibilityLabel={`${t('notices.attachments')} ${attachment.name}`}
      accessibilityHint={t('notices.preview')}
      bg="transparent"
      style={styles.row}
    >
      {showThumb ? (
        <Image
          source={{
            uri: buildAttachmentUrl(
              attachment.url,
              sourceUrl,
              'inline',
              attachment.name,
            ),
          }}
          style={styles.thumb}
          resizeMode="cover"
          onError={handleThumbError}
        />
      ) : (
        <KindTile kind={kind} />
      )}

      <View style={styles.body}>
        <Txt
          typography="t5"
          fontWeight="medium"
          color="neutral"
          numberOfLines={2}
          lineBreakStrategyIOS="hangul-word"
        >
          {role ?? attachment.name}
        </Txt>
        {role !== null ? (
          <Txt typography="t3" color="neutralSubtle" numberOfLines={1}>
            {attachment.name}
          </Txt>
        ) : extLabel ? (
          <Txt typography="t3" color="neutralSubtle">
            {extLabel}
          </Txt>
        ) : null}
      </View>

      {/* WHY: hitSlop gives a 44pt target while the visible 32pt circle stays quieter than the file name. */}
      <Pressable
        onPress={() => onDownload(attachment)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('notices.download')}
        bg="transparent"
        style={styles.downloadBtn}
      >
        <DownloadSimpleIcon size={17} color={color.fg.neutralSubtle} />
      </Pressable>
    </Pressable>
  );
}

/** WHY: slides keep orange, a file type's category hue no role holds, under one exception in KindTile. */
const KIND_STYLE: Record<
  AttachmentKind,
  { bg: BgColorName | 'orange'; fg: FgColorName | 'orange'; Icon: typeof FileIcon }
> = {
  image: { bg: 'informativeWeak', fg: 'informative', Icon: ImageIcon },
  pdf: { bg: 'criticalWeak', fg: 'critical', Icon: FilePdfIcon },
  // WHY: Phosphor's FileDoc is a Word glyph and would mislabel an hwp file, so documents get the clip.
  doc: { bg: 'informativeWeak', fg: 'informative', Icon: PaperclipIcon },
  sheet: { bg: 'positiveWeak', fg: 'positive', Icon: FileXlsIcon },
  slide: { bg: 'orange', fg: 'orange', Icon: FilePptIcon },
  archive: { bg: 'neutralWeak', fg: 'neutralSubtle', Icon: FileZipIcon },
  other: { bg: 'neutralWeak', fg: 'neutralSubtle', Icon: FileIcon },
};

function KindTile({ kind }: { kind: AttachmentKind }) {
  const styles = useStyles();
  const color = useSemanticColors();
  const scheme = useResolvedScheme();
  const { bg, fg, Icon } = KIND_STYLE[kind];
  // eslint-disable-next-line sds/no-static-theme -- a file type's category hue, not a status: the slide tile keeps the orange no role holds
  const orange = { bg: SdsPalette.orange[100][scheme], fg: SdsPalette.orange[500][scheme] };
  return (
    <View
      style={[
        styles.thumb,
        styles.kindTile,
        { backgroundColor: bg === 'orange' ? orange.bg : color.bg[bg] },
      ]}
    >
      <Icon size={20} color={fg === 'orange' ? orange.fg : color.fg[fg]} />
    </View>
  );
}

const THUMB_SIZE = 44;

const useStyles = createThemedStyles(({ color }) => ({
  list: {
    // WHY: the space above the list belongs to SummaryCard's body margin.
    gap: SdsSpacing.x2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x3,
    paddingVertical: SdsSpacing.x2_5,
    paddingHorizontal: SdsSpacing.x3,
    borderRadius: SdsRadius.r2_5,
    borderWidth: 1,
    borderColor: color.stroke.neutralMuted,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: SdsRadius.r2,
    backgroundColor: color.bg.neutralWeak,
  },
  kindTile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: SdsSpacing.x0_5,
  },
  downloadBtn: {
    width: 32,
    height: 32,
    borderRadius: SdsRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
