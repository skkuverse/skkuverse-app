/**
 * QUIRK(ios): UIKit fires no value change for a tap on the selected segment, and a re-tap is how a user asks
 * to go back to that campus, so this is the SDS control inside our own `GlassSurface` on iOS 26 too.
 * `style` goes last to beat the control's default `grey100` track.
 */

import { useCallback } from 'react';
import { GLASS_AVAILABLE, GlassSurface, SegmentedControl as SDSSegmentedControl, createThemedStyles } from '@skkuverse/sds';
import { type Campus } from '@skkuverse/shared';
import { useSelectedCampus } from '../../useSelectedCampus';
import { MAP_CONTROL_HEIGHT } from '../../map-layout.constants';
import type { CampusDef } from '../../map-config.types';

interface CampusToggleProps {
  campuses: CampusDef[];
  /** WHY: fires on every pick, a re-tap included; that is the only signal the user wants the camera back. */
  onPick: (campusId: Campus) => void;
  height?: number;
  glass?: boolean;
}

export function CampusToggle({ campuses, onPick, height = MAP_CONTROL_HEIGHT, glass = true }: CampusToggleProps) {
  const styles = useStyles();
  const selectedCampus = useSelectedCampus();
  const onGlass = GLASS_AVAILABLE && glass;
  const size = { height, borderRadius: height / 2 };

  // WHY: recovering the union by lookup keeps the closed set closed without a cast.
  const handleValueChange = useCallback(
    (value: string) => {
      const picked = campuses.find((c) => c.id === value);
      if (picked) onPick(picked.id);
    },
    [campuses, onPick],
  );

  const control = (
    <SDSSegmentedControl
      style={[onGlass ? styles.controlOnGlass : styles.control, size]}
      value={selectedCampus}
      onValueChange={handleValueChange}
    >
      {campuses.map((c) => (
        <SDSSegmentedControl.Item key={c.id} value={c.id} typography="t3">
          {c.label}
        </SDSSegmentedControl.Item>
      ))}
    </SDSSegmentedControl>
  );

  if (!onGlass) return control;

  // WHY: `overflow: 'hidden'` clips the material to the capsule; `borderRadius` alone rounds only the fill.
  return <GlassSurface style={[styles.trackSurface, size]}>{control}</GlassSurface>;
}

const useStyles = createThemedStyles(() => ({
  trackSurface: {
    flex: 1,
    overflow: 'hidden',
  },
  control: {
    flex: 1,
    justifyContent: 'center',
  },
  controlOnGlass: {
    flex: 1,
    justifyContent: 'center',
    // WHY: beats the control's own `grey100` track, which would sit as an opaque plate over the glass.
    backgroundColor: 'transparent',
  },
}));
