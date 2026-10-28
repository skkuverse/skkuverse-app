import { View } from 'react-native';
import { XIcon } from 'phosphor-react-native';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { GlassSurface, Pressable, Txt, useSemanticColors, createThemedStyles } from '@skkuverse/sds';

const NOTICE_TOP = 12;

// eslint-disable-next-line sds/no-handbuilt-part -- page banner: SDS has no page banner yet (design-usage Missing components, CALLOUT-07)
export function NoticeBanner({
  title,
  subtitle,
  onDismiss,
  headerOverContent,
  headerHeight,
}: {
  title: string;
  subtitle: string;
  onDismiss: () => void;
  headerOverContent: boolean;
  headerHeight: number;
}) {
  const styles = useStyles();
  const color = useSemanticColors();
  return (
    <View
      // WHY: under a header laid over the content (overlay, iOS) y = 0 is beneath it, and an
      // absolute view ignores the container's padding, so the banner moves down itself.
      style={[styles.topNotice, headerOverContent && { top: headerHeight + NOTICE_TOP }]}
      pointerEvents="box-none"
    >
      <GlassSurface interactive style={styles.topNoticePill}>
        <View style={styles.topNoticeInner}>
          <View style={styles.topNoticeText}>
            <Txt typography="t7" fontWeight="bold" color="neutral" numberOfLines={1}>
              {title}
            </Txt>
            <Txt typography="t3" color="neutralSubtle" numberOfLines={1}>
              {subtitle}
            </Txt>
          </View>
          <Pressable
            onPress={onDismiss}
            bg="transparent"
            style={styles.topNoticeClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="공지 닫기"
          >
            <XIcon size={18} color={color.fg.neutralSubtle} weight="bold" />
          </Pressable>
        </View>
      </GlassSurface>
    </View>
  );
}

const useStyles = createThemedStyles(() => ({
  topNotice: {
    position: 'absolute',
    top: NOTICE_TOP,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  topNoticePill: {
    alignSelf: 'stretch',
    // eslint-disable-next-line sds/no-radius-literal -- the floating glass notice's drawn corner: r4 or r5 would move it 2pt, and the glass surfaces keep their platform-matched metrics
    borderRadius: 18,
    overflow: 'hidden',
  },
  topNoticeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x3,
    paddingLeft: SdsSpacing.x4_5,
    paddingRight: SdsSpacing.x3,
    paddingVertical: SdsSpacing.x3,
  },
  topNoticeText: {
    flex: 1,
    gap: SdsSpacing.x0_5,
  },
  topNoticeClose: {
    width: 28,
    height: 28,
    borderRadius: SdsRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
