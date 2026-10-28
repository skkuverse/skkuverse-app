import { useCallback, useState } from 'react';
import {
  Image,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  EnvelopeSimpleIcon,
  LinkSimpleIcon,
  PhoneIcon,
} from 'phosphor-react-native';
import { SdsPalette, SdsRadius, useT, SdsSpacing } from '@skkuverse/shared';
import { Pressable, Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import type {
  ExtractedImage,
  ExtractedLink,
} from '../content-refs.rules';
import { useLinkPreviews } from './useLinkPreviews';
import { openExternalUrl } from '@/platform/handoff';

interface Props {
  images: ExtractedImage[];
  links: ExtractedLink[];
  emails: string[];
  phones: string[];
  /** WHY: sent as Referer, which department servers check to block hotlinking. */
  sourceUrl: string;
  onImagePress: () => void;
  onCopyContact: (value: string) => void;
}

/** WHY: a notice's substance is usually a poster, a link and a contact; lifted here, they work without opening the body. */
export function NoticeContentRefs({
  images,
  links,
  emails,
  phones,
  sourceUrl,
  onImagePress,
  onCopyContact,
}: Props) {
  const styles = useStyles();
  const { t } = useT();
  const hasAny =
    images.length > 0 || links.length > 0 || emails.length > 0 || phones.length > 0;
  if (!hasAny) return null;

  return (
    <View style={styles.wrap}>
      {images.map((img) => (
        <BodyImage
          key={img.url}
          image={img}
          sourceUrl={sourceUrl}
          onPress={onImagePress}
        />
      ))}
      {links.length > 0 ? <LinkList links={links} /> : null}
      {/* WHY: contacts share the link and attachment row form, so the three read as one list. */}
      {phones.map((p) => (
        <RefRow
          key={p}
          Icon={PhoneIcon}
          title={p}
          subtitle={t('notices.refPhone')}
          onPress={() => onCopyContact(p)}
        />
      ))}
      {emails.map((e) => (
        <RefRow
          key={e}
          Icon={EnvelopeSimpleIcon}
          title={e}
          subtitle={t('notices.refEmail')}
          onPress={() => onCopyContact(e)}
        />
      ))}
    </View>
  );
}

/** WHY: the same size and spacing as NoticeAttachments' row, so the two lists read as one. */
function RefRow({
  Icon,
  title,
  subtitle,
  onPress,
  thumbnailUrl,
  onThumbnailError,
  tint: tintProp,
  tintBg: tintBgProp,
}: {
  Icon: typeof LinkSimpleIcon;
  title: string;
  subtitle: string;
  onPress: () => void;
  thumbnailUrl?: string | null;
  onThumbnailError?: () => void;
  tint?: string;
  tintBg?: string;
}) {
  const color = useSemanticColors();
  const styles = useStyles();
  const tint = tintProp ?? color.fg.informative;
  const tintBg = tintBgProp ?? color.bg.informativeWeak;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${subtitle} ${title}`}
      bg="transparent"
      style={styles.row}
    >
      {thumbnailUrl ? (
        <Image
          source={{ uri: thumbnailUrl }}
          style={styles.thumb}
          resizeMode="cover"
          onError={onThumbnailError}
        />
      ) : (
        <View style={[styles.thumb, styles.tile, { backgroundColor: tintBg }]}>
          <Icon size={18} color={tint} />
        </View>
      )}
      <View style={styles.rowBody}>
        <Txt
          typography="t5"
          fontWeight="medium"
          color="neutral"
          numberOfLines={2}
          lineBreakStrategyIOS="hangul-word"
        >
          {title}
        </Txt>
        <Txt typography="t3" color="neutralSubtle" numberOfLines={1}>
          {subtitle}
        </Txt>
      </View>
    </Pressable>
  );
}

/**
 * EVIDENCE: 18 of 20 sampled images carry the `{WxH}` hint, so the ratio is fixed before load. The height
 * cap is required: a real notice held a 5244x43450 scan, forty screens tall at its ratio.
 */
function BodyImage({
  image,
  sourceUrl,
  onPress,
}: {
  image: ExtractedImage;
  sourceUrl: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { width: screenW } = useWindowDimensions();
  // WHY: the detail screen's scroll pads 20 on each side.
  const contentWidth = screenW - 40;
  const hintRatio =
    image.width && image.height ? image.height / image.width : null;
  const [ratio, setRatio] = useState<number | null>(hintRatio);
  const [failed, setFailed] = useState(false);

  const handleLoad = useCallback(
    (e: { nativeEvent: { source: { width: number; height: number } } }) => {
      const { width, height } = e.nativeEvent.source;
      if (width > 0 && height > 0) setRatio(height / width);
    },
    [],
  );

  if (failed) return null;

  const MAX_HEIGHT = 520;
  const naturalHeight = contentWidth * (ratio ?? 0.75);
  const height = Math.min(naturalHeight, MAX_HEIGHT);
  // WHY: a clipped image must say so, or the reader cannot tell there is more.
  const isClipped = naturalHeight > MAX_HEIGHT + 1;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel={image.alt || undefined}
      bg="layerBasement"
      style={styles.imageWrap}
    >
      <Image
        source={{ uri: image.url, headers: { Referer: sourceUrl } }}
        style={{ width: contentWidth, height }}
        resizeMode={isClipped ? 'cover' : 'contain'}
        onLoad={handleLoad}
        onError={() => setFailed(true)}
      />
      {isClipped ? (
        <View style={styles.clipHint}>
          <Txt typography="t1" fontWeight="semibold" style={{ color: SdsPalette.static.white }}>
            전체 보기
          </Txt>
        </View>
      ) : null}
    </Pressable>
  );
}

function LinkList({ links }: { links: ExtractedLink[] }) {
  const previews = useLinkPreviews(links.map((l) => l.url));

  return (
    <>
      {links.map((link, i) => (
        <LinkRow key={link.url} link={link} preview={previews[i]?.data ?? null} />
      ))}
    </>
  );
}

function LinkRow({
  link,
  preview,
}: {
  link: ExtractedLink;
  preview: { title: string | null; imageUrl: string | null } | null;
}) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const handleThumbError = useCallback(() => setThumbFailed(true), []);

  // WHY: the link text outranks the OG title because it is the name this notice gave the link.
  const title = link.text ?? preview?.title ?? link.domain;

  return (
    <RefRow
      Icon={LinkSimpleIcon}
      title={title}
      subtitle={link.domain}
      thumbnailUrl={thumbFailed ? null : preview?.imageUrl}
      onThumbnailError={handleThumbError}
      onPress={() => void openExternalUrl(link.url)}
    />
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  wrap: {
    // WHY: the space above belongs to SummaryCard's body margin, so it holds when there is no body.
    gap: SdsSpacing.x2,
  },
  imageWrap: {
    borderRadius: SdsRadius.r2_5,
    overflow: 'hidden',
  },
  clipHint: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    paddingHorizontal: SdsSpacing.x2_5,
    paddingVertical: SdsSpacing.x1,
    borderRadius: SdsRadius.full,
    // WHY: static, since the photo under the pill is dark in either scheme.
    backgroundColor: SdsPalette.static.greyOpacity800,
  },
  // WHY: matches NoticeAttachments' row; the lists sit together, so change both at once.
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
    width: 44,
    height: 44,
    borderRadius: SdsRadius.r2,
    backgroundColor: color.bg.neutralWeak,
  },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: SdsSpacing.x0_5,
  },
}));
