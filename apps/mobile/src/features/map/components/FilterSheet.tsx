/**
 * WHY: tiles, not text pills: a tile shows what turning a layer on does. No campus section; the toggle on the
 * map is the one campus control. A glass sheet that never reaches `large` resolves to gorhom's detached card.
 */

import { forwardRef } from 'react';
import { View } from 'react-native';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { MapTile } from './MapTile';
import { useFilterLayerState } from './useFilterLayerState';
import { toCssColor } from './canvas/css-color.rules';
import { Sheet, SheetCloseButton, Tossface, useSheetBottomInset, type SheetRef, createThemedStyles, useSemanticColors, Txt } from '@skkuverse/sds';
import { logLayerToggle } from '@/platform/analytics';
import type { MapConfig, MapLayerDef } from '../map-config.types';
import { SHEET_CONTENT_BOTTOM } from '../sheet-detents.constants';
import { isLayerVisible, type LayerVisibilityInputs } from '../layers.rules';

/** WHY: a lookup with a fallback, not an exhaustive record: `MapLayerDef.id` is an open server string. */
const LAYER_EMOJI: Readonly<Record<string, string>> = {
  building_numbers: '\u{1F522}',
  building_labels: '\u{1F3E2}',
};
const LAYER_EMOJI_FALLBACK = '\u{1F4CD}';

/**
 * WHY: the two permanent building layers get an emoji; server-driven layers get a dot in their own colour,
 * which is what their markers draw.
 */
function LayerBadge({ layer }: { layer: MapLayerDef }) {
  const color = useSemanticColors();
  const styles = useStyles();
  const emoji = LAYER_EMOJI[layer.id];
  if (emoji) return <Tossface size={17} style={styles.badgeEmoji}>{emoji}</Tossface>;
  if (layer.style?.color) {
    return (
      <View
        style={[
          styles.badgeDot,
          { backgroundColor: toCssColor(layer.style.color, color.bg.brandSolid) },
        ]}
      />
    );
  }
  return <Tossface size={17} style={styles.badgeEmoji}>{LAYER_EMOJI_FALLBACK}</Tossface>;
}

interface FilterSheetProps {
  mapConfig: MapConfig;
  /** WHY: the host's tiers, so a tile and the map behind it read one state. */
  layerState: LayerVisibilityInputs;
  /**
   * WHY: passed in, since only the host knows where the campus card stops; a locally computed safe area would
   * sit visibly higher than the card behind it.
   */
  bottomGap: number;
  /** WHY: passed down, not a second clock, so a tile and the map cannot land on opposite sides of a boundary. */
  now: number;
}

export const FilterSheet = forwardRef<SheetRef, FilterSheetProps>(
  function FilterSheet({ mapConfig, layerState, bottomGap, now }, ref) {
    const styles = useStyles();
    const { setLayerOverride } = useFilterLayerState();
    const { t } = useT();
    const bottomInset = useSheetBottomInset();

    return (
      <Sheet
        ref={ref}
        // WHY: `medium`, not a percentage: the sheet does not move, so a second detent would be dead config.
        position={{ kind: 'stuck', detent: 'medium' }}
        surface="glass"
        // WHY: no drag, so a downward swipe meant to scroll never pulls the sheet shut; the X and backdrop close it.
        dismissible={false}
        // WHY: `Sheet` dims a glass card far less, since a half-black scrim would turn glass into a grey panel.
        backdrop
        bottomGap={bottomGap}
        // WHY: it can open over the peek sheet, and the default 'switch' would minimise that sheet and resurface it.
        stackBehavior="replace"
      >
        {/* WHY: a sibling of the scroll view, so the X stays one tap away at every scroll position. */}
        <View style={styles.header}>
          <Txt typography="t7" fontWeight="bold" style={styles.headerTitle}>{t('filter.layer')}</Txt>
          <SheetCloseButton label={t('common.close')} />
        </View>

        {/* QUIRK(ios): a ScrollView rubber-bands with nothing to scroll, making a short sheet feel draggable; `overScrollMode` is the Android half. */}
        <Sheet.ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: SHEET_CONTENT_BOTTOM + bottomInset }]}
          bounces={false}
          overScrollMode="never"
        >
          <View style={styles.grid}>
            {mapConfig.layers
              // WHY: governs the affordance only; a locked layer still renders, fetches and deep-links. Absent means true.
              .filter((layer) => layer.userConfigurable !== false)
              .map((layer) => {
                // WHY: the same function the map renders with, so the tile cannot disagree with the map.
                const visible = isLayerVisible(layer, layerState, now);
                return (
                  <View key={layer.id} style={styles.col}>
                    <MapTile
                      label={layer.label}
                      selected={visible}
                      onPress={() => {
                        // WHY: the target, not a flip; the store holds only what the user expressed and cannot resolve the current value.
                        setLayerOverride(layer.id, !visible);
                        logLayerToggle(layer.id, !visible);
                      }}
                      badge={<LayerBadge layer={layer} />}
                    />
                  </View>
                );
              })}
          </View>
        </Sheet.ScrollView>
      </Sheet>
    );
  },
);

const BADGE_DOT_SIZE = 14;

const useStyles = createThemedStyles(({ color }) => ({
  badgeDot: {
    width: BADGE_DOT_SIZE,
    height: BADGE_DOT_SIZE,
    borderRadius: BADGE_DOT_SIZE / 2,
  },
  content: {
    padding: SdsSpacing.x4,
    // WHY: the pinned header already spaces the content off the rounded top edge.
    paddingTop: 0,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // WHY: outside the scroll view, so it takes the same max-width track as the grids.
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: SdsSpacing.x4,
    paddingTop: SdsSpacing.x5,
    paddingBottom: SdsSpacing.x2,
  },
  headerTitle: {
    color: color.fg.neutral,
  },
  /** WHY: the gutter is on the columns, not `gap`, since `gap` plus `width: 25%` overflows to three per row. */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -SdsSpacing.x1_5,
  },
  col: {
    width: '25%',
    paddingHorizontal: SdsSpacing.x1_5,
    marginBottom: SdsSpacing.x2,
  },
  badgeEmoji: {
    // eslint-disable-next-line sds/no-type-size-literal -- the emoji's line box inside the badge; an emoji is not on the type scale
    lineHeight: 20,
  },
}));
