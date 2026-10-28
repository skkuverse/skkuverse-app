import { useMemo } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { CaretRightIcon } from 'phosphor-react-native';
import { Pressable, Toast, Tossface, Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import { useT, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { tossfaceGridMetrics } from '@/components/TossfaceButtonGrid';
import { GlowBackdrop } from '@/components/GlowBackdrop';
import type { MiniAppFeedSectionCard } from './feed.types';
import { useMiniAppFeedSection } from './useMiniAppFeedSection';

/** SEE: docs/explanation/miniapp-shell.md ("The feed on home") */
export function MiniAppFeedSection({ miniAppId, title: sectionTitle }: { miniAppId: string; title?: string }) {
  const color = useSemanticColors();
  const styles = useStyles();
  const { t } = useT();
  const { width: screenW } = useWindowDimensions();
  const { innerWidth, itemSize, gap } = useMemo(() => tossfaceGridMetrics(screenW), [screenW]);
  const { title, card, pushNotice, openList, onPressCard, onCloseNotice } = useMiniAppFeedSection({
    miniAppId,
    title: sectionTitle,
  });

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Txt
          typography="t9"
          fontWeight="bold"
          color="neutral"
          numberOfLines={1}
          style={styles.title}
          accessibilityRole="header"
        >
          {title}
        </Txt>
        <Pressable
          onPress={openList}
          bg="transparent"
          style={styles.moreBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${title} ${t('common.viewAll')}`}
        >
          <Txt typography="t3" color="neutralSubtle">
            {t('common.viewAll')}
          </Txt>
          <CaretRightIcon size={12} color={color.fg.placeholder} />
        </Pressable>
      </View>
      <Pressable
        onPress={onPressCard}
        bg="layerDefault"
        style={[styles.box, { width: innerWidth, height: itemSize, marginBottom: gap }]}
        accessibilityRole="button"
        accessibilityLabel={card.a11yLabel}
      >
        {card.kind === 'latest' && card.fresh ? (
          <GlowBackdrop color={color.fg.ai} tint={color.bg.aiWeak} borderRadius={SdsRadius.r4} breaths="forever" />
        ) : null}
        <Tossface size={26} style={styles.megaphone}>{'\u{1F4E2}'}</Tossface>
        <View style={styles.content}>{renderCardText(card)}</View>
        <CaretRightIcon size={18} color={color.fg.placeholder} style={styles.chevron} />
      </Pressable>
      <Toast open={pushNotice !== null} text={pushNotice ?? ''} onClose={onCloseNotice} />
    </View>
  );
}

function renderCardText(card: MiniAppFeedSectionCard) {
  switch (card.kind) {
    case 'askPush':
    case 'latest':
      return (
        <>
          <Txt typography="t4" fontWeight="semiBold" color="neutral" numberOfLines={1}>
            {card.title}
          </Txt>
          <Txt typography="t4" color="neutralSubtle" numberOfLines={1}>
            {card.body}
          </Txt>
        </>
      );
    case 'empty':
      return (
        <Txt typography="t4" color="neutralSubtle" numberOfLines={1}>
          {card.body}
        </Txt>
      );
  }
}

const useStyles = createThemedStyles(({ color }) => ({
  section: {
    alignSelf: 'stretch',
    marginTop: SdsSpacing.x3,
  },
  // WHY: HomeScreen's sectionHeader, so this heading lines up with the sections below it.
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SdsSpacing.gutter,
    marginBottom: SdsSpacing.x3,
  },
  title: {
    flex: 1,
    marginRight: SdsSpacing.x3,
  },
  moreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x0_5,
    flexShrink: 0,
    borderRadius: SdsRadius.r1,
  },
  // WHY: the grid tile's own surface (TossfaceButtonGrid `button`), so the box reads as one
  // more tile, only wider.
  box: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x3,
    borderRadius: SdsRadius.r4,
    borderWidth: 1,
    borderColor: color.stroke.neutralMuted,
    paddingHorizontal: SdsSpacing.x4,
  },
  // WHY: the tile emoji's size (TossfaceButtonGrid `emoji`), as the box is one more tile.
  megaphone: {
    // eslint-disable-next-line sds/no-type-size-literal -- the emoji's line box, as the tile emoji's; an emoji is not on the type scale
    lineHeight: 32,
  },
  content: {
    flex: 1,
    gap: SdsSpacing.x0_5,
  },
  chevron: {
    flexShrink: 0,
  },
}));
