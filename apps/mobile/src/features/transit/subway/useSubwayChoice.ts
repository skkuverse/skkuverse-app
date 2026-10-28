import { useState } from 'react';
import {
  useSettingsStore,
  type SubwayDirectionKey,
} from '@skkuverse/shared';
import { toSubwayScreenChoice, type SubwayScreenChoice } from './subway.rules';
import type { SubwayLineArrivals } from './subway.types';

// WHY: nothing is written for a pick the screen only resolved, so an untouched station keeps following the defaults.
export function useSubwayChoice(
  station: string | undefined,
  lineParam: string | undefined,
  lines: readonly SubwayLineArrivals[] | undefined,
): {
  choice: SubwayScreenChoice | undefined;
  onSelectLine: (lineCode: string) => void;
  onSelectDirection: (lineCode: string, direction: SubwayDirectionKey) => void;
} {
  const saved = useSettingsStore((s) => (station ? s.subwayChoices[station] : undefined));
  const setLine = useSettingsStore((s) => s.setSubwayLine);
  const setDirection = useSettingsStore((s) => s.setSubwayDirection);
  // WHY: once a line is tapped the store holds it, and the link's line would
  // otherwise keep outranking it for the rest of the visit.
  const [lineTapped, setLineTapped] = useState(false);

  const choice = lines
    ? toSubwayScreenChoice(lines, { lineParam: lineTapped ? undefined : lineParam, saved })
    : undefined;

  return {
    choice,
    onSelectLine: (lineCode) => {
      if (!station) return;
      setLine(station, lineCode);
      setLineTapped(true);
    },
    onSelectDirection: (lineCode, direction) => {
      if (!station) return;
      setDirection(station, lineCode, direction);
    },
  };
}
