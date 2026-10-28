/**
 * WHY: the panel replaces the feed's `Sheet.ScrollView` instead of nesting, since a gorhom scrollable cannot
 * nest inside another; both register with the sheet's draggable context, so the pan gesture survives.
 */

import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { CaretDownIcon } from 'phosphor-react-native';
import {
  useT,
  SdsSpacing,
} from '@skkuverse/shared';
import { Chip, Pressable, ResultSection, Sheet, createThemedStyles } from '@skkuverse/sds';
import { logCampusContentSelect } from '@/platform/analytics';
import { PlaceCard } from './components/PlaceCard';
import { isFacetNarrowed, isWholeFacet, type FacetSelection } from './event-list.rules';
import type { MapChipList } from '../map-config.types';
import type { MapOverlay } from '../overlay.types';

interface EventListPanelProps {
  places: readonly MapOverlay[];
  now: number;
  onSelectPlace: (place: MapOverlay) => void;
  /** QUIRK(ios): from iOS 26 the tab bar floats over the bottom of this list at the top detent. */
  bottomPadding: number;
  list: MapChipList | null;
  selection: FacetSelection;
  onOpenFacet: (facetId: string) => void;
}

export function EventListPanel({
  places,
  now,
  onSelectPlace,
  bottomPadding,
  list,
  selection,
  onOpenFacet,
}: EventListPanelProps) {
  const styles = useStyles();
  const { t } = useT();
  const renderItem = useCallback(
    ({ item }: { item: MapOverlay }) => (
      <Pressable
        bg="layerFloating"
        scaleScope="content"
        style={styles.row}
        accessibilityRole="button"
        onPress={() => {
          logCampusContentSelect({ content_type: 'eventmap_list_row', item_id: item.id });
          onSelectPlace(item);
        }}
      >
        <PlaceCard place={item} now={now} variant="compact" />
      </Pressable>
    ),
    [now, onSelectPlace, styles],
  );

  const header =
    list && list.facets.length > 0 ? (
      <View style={styles.filters}>
        {list.facets.map((facet) => {
          const held = selection[facet.id] ?? [];
          const value = isWholeFacet(facet, held) && facet.options.length > 1
            ? t('common.total')
            : facet.options
                .filter((o) => held.includes(o.id))
                .map((o) => o.label)
                .join(', ');
          const engaged = isFacetNarrowed(facet, held);
          return (
            <Chip.Toggle
              key={facet.id}
              variant="outlineWeak"
              tone="brand"
              checked={engaged}
              onCheckedChange={() => {
                logCampusContentSelect({ content_type: 'eventmap_list_facet', item_id: facet.id });
                onOpenFacet(facet.id);
              }}
            >
              <Chip.Label>{`${facet.label}: ${value}`}</Chip.Label>
              <Chip.SuffixIcon>
                <CaretDownIcon weight="bold" />
              </Chip.SuffixIcon>
            </Chip.Toggle>
          );
        })}
      </View>
    ) : null;

  return (
    <Sheet.FlatList
      data={places as MapOverlay[]}
      keyExtractor={(item: MapOverlay) => item.id}
      renderItem={renderItem}
      style={styles.list}
      contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding }]}
      ItemSeparatorComponent={Separator}
      ListHeaderComponent={header}
      ListEmptyComponent={<ResultSection size="medium" title={t('eventmap.list.empty')} />}
    />
  );
}

function Separator() {
  const styles = useStyles();
  return <View style={styles.separator} />;
}

/**
 * WHY: measured from the card's edge, not the screen's: the sheet body carries the animated inset, so the
 * gutter stays right at every detent, as the feed's does.
 */
const GUTTER = SdsSpacing.x4;

const useStyles = createThemedStyles(({ color }) => ({
  list: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  listContent: { paddingHorizontal: GUTTER },
  row: { paddingVertical: SdsSpacing.x3 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: color.stroke.neutralSubtle },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: SdsSpacing.x2, paddingTop: SdsSpacing.x1, paddingBottom: SdsSpacing.x2 },
}));
