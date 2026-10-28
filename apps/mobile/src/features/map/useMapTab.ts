import { useMemo } from 'react';
import { CAMPUS_SHEET_DETENTS } from './campus-sheet.rules';
import { useCampusSections } from './campus-sheet/useCampusSections';
import { useMapLinks } from './components/host/useMapLinks';
import { useMapLayout } from './useMapLayout';

export function useMapTab() {
  const { sheetContentBottom } = useMapLayout();

  const snapPercents = CAMPUS_SHEET_DETENTS.percents;
  const { data: campusFeed } = useCampusSections();
  const sections = campusFeed?.sections ?? [];

  /**
   * WHY: the SDS names stay, since `large` is the detent that attaches and makes the glass card opaque; the low two
   * are overridden because the host's locate row parks at `medium` (`parkTopOf`).
   */
  const sheetPosition = useMemo(
    () =>
      ({
        kind: 'expandable',
        detents: ['small', 'medium', 'large'],
        initial: CAMPUS_SHEET_DETENTS.initial,
        heights: {
          small: `${snapPercents[0]}%`,
          medium: `${snapPercents[1]}%`,
        },
      }) as const,
    [snapPercents],
  );

  useMapLinks();

  return {
    sheetPosition,
    sections,
    sheetContentBottom,
  };
}
