/**
 * WHY: no `selected` prop: a chip sets a whole group's visibility, which the filter sheet can change, so
 * `ActiveChipStrip` replaces this row instead. A horizontal ScrollView claims a band the map cannot be panned
 * through; the overflow off the right edge is the affordance, so the band stays chip-high.
 */

import { ScrollView, StyleSheet } from 'react-native';
import { ArrowUpRightIcon, CaretRightIcon } from 'phosphor-react-native';
import { GlassChip, Tossface, useSemanticColors } from '@skkuverse/sds';
import { SdsSpacing } from '@skkuverse/shared';
import type { ChipMark } from '../../chips.rules';
import type { MapChip } from '../../map-config.types';

interface CampusChipRowProps {
  chips: MapChip[];
  onPress: (chip: MapChip) => void;
  /** WHY: the native shell's row stays unmarked, as installed builds draw it. */
  markOf?: (chip: MapChip) => ChipMark;
}

const MARK_SIZE = 12;

export function CampusChipRow({ chips, onPress, markOf }: CampusChipRowProps) {
  const color = useSemanticColors();
  // WHY: the control column spaces its children with a gap, so a zero-height row would still leave a hole.
  if (!chips.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.content}
      // QUIRK(android): a ScrollView clips to its own bounds, and the chips must clear the search bar's shadow.
      keyboardShouldPersistTaps="handled"
    >
      {chips.map((chip) => (
        <GlassChip
          key={chip.id}
          label={chip.label}
          // WHY: `icon` is nullable on the wire, so a text-only chip can arrive without a coordinated release.
          icon={
            chip.icon ? <Tossface size={15} style={styles.emoji}>{chip.icon.emoji}</Tossface> : undefined
          }
          trailing={markIcon(markOf?.(chip) ?? null, color.fg.neutralSubtle)}
          onPress={() => onPress(chip)}
        />
      ))}
    </ScrollView>
  );
}

function markIcon(mark: ChipMark, tint: string) {
  switch (mark) {
    case 'leaves':
      return <ArrowUpRightIcon size={MARK_SIZE} color={tint} weight="bold" />;
    case 'moves':
      return <CaretRightIcon size={MARK_SIZE} color={tint} weight="bold" />;
    case null:
      return undefined;
  }
}

const styles = StyleSheet.create({
  scroll: {
    // WHY: cancels the column's 16pt inset so the strip runs edge to edge; otherwise the last chip reads as the
    // end of the list rather than as clipped.
    marginHorizontal: -SdsSpacing.x4,
    // WHY: `flexGrow: 0` is load-bearing: a horizontal ScrollView in a column otherwise swallows the whole map.
    flexGrow: 0,
  },
  content: {
    paddingHorizontal: SdsSpacing.x4,
    alignItems: 'center',
    gap: SdsSpacing.x2,
  },
  emoji: {
    // QUIRK(tossface): its glyphs sit high in their em box and ride above the label's baseline without this.
    // eslint-disable-next-line sds/no-type-size-literal -- the emoji's line box; an emoji is not on the type scale
    lineHeight: 18,
  },
});
