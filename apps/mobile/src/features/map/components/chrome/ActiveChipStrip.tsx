/**
 * WHY: replaces `CampusChipRow` at its full width and with `GlassChip`'s metrics, so tapping a chip never
 * nudges the map's lower controls. The cost is that another chip is two taps away.
 */

import { XIcon } from 'phosphor-react-native';
import { SdsRadius, SdsSpacing, SdsTypeScale } from '@skkuverse/shared';
import { GlassSurface, Pressable, Tossface, Txt, useSemanticColors, createThemedStyles } from '@skkuverse/sds';
import type { MapChip } from '../../map-config.types';

interface ActiveChipStripProps {
  chip: MapChip;
  onClear: () => void;
  clearLabel: string;
}

const CLEAR_SIZE = 18;
const CLEAR_HIT_SLOP = 13;

export function ActiveChipStrip({ chip, onClear, clearLabel }: ActiveChipStripProps) {
  const styles = useStyles();
  const color = useSemanticColors();
  return (
    // WHY: not `interactive`: this surface is a label with one small button, and lighting the whole strip would
    // promise a tap target that is not there.
    <GlassSurface style={styles.strip}>
      {chip.icon ? <Tossface size={15} style={styles.emoji}>{chip.icon.emoji}</Tossface> : null}
      {/* WHY: `flex: 1`, not `space-between`, so the clear control sits hard right and the label truncates within the middle instead of leaving a gap that grows with the screen. */}
      <Txt typography="t4" fontWeight="bold" numberOfLines={1} style={styles.label}>
        {chip.label}
      </Txt>
      <Pressable
        onPress={onClear}
        // WHY: 18pt drawn plus 13 each side is 44, Apple's minimum.
        hitSlop={CLEAR_HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={clearLabel}
        bg="neutralWeak"
        style={styles.clear}
      >
        <XIcon size={14} color={color.fg.neutralSubtle} weight="bold" />
      </Pressable>
    </GlassSurface>
  );
}

const LABEL_LINE_HEIGHT = SdsTypeScale.t4.lineHeight;

const useStyles = createThemedStyles(({ color }) => ({
  strip: {
    // WHY: no `alignSelf`, so it stretches to the chip row's span.
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x1_5,
    // WHY: `overflow` is load-bearing on the glass path: the effect bleeds past the rounded corners without it.
    borderRadius: SdsRadius.full,
    overflow: 'hidden',
    paddingHorizontal: SdsSpacing.x3_5,
    // eslint-disable-next-line sds/no-spacing-literal -- GlassChip's own 9 (see Glass.tsx), so the strip stays the chip row's height; the iOS 26 glass pill is drawn to its own metrics
    paddingVertical: 9,
  },
  emoji: {
    // QUIRK(tossface): its glyphs sit high in their em box and ride above the label's baseline without this.
    lineHeight: LABEL_LINE_HEIGHT,
  },
  // WHY: heavier than a chip's label, since it names the view rather than offering it.
  label: {
    flex: 1,
  },
  clear: {
    width: CLEAR_SIZE,
    height: CLEAR_SIZE,
    borderRadius: CLEAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
