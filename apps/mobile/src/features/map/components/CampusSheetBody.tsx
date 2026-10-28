/** WHY: the sheet's own scroll view, so the drag gesture stays with the card. */

import { useCallback, useRef, type ComponentProps } from 'react';
import type { BottomSheetScrollViewMethods } from '@gorhom/bottom-sheet';
import { SdsSpacing } from '@skkuverse/shared';
import { Sheet, createThemedStyles } from '@skkuverse/sds';
import { useScrollToTopOnRetap } from '@/components/useScrollToTopOnRetap';
import { SduiSectionList } from '../campus-sheet/SduiSectionList';

interface CampusSheetBodyProps {
  sections: ComponentProps<typeof SduiSectionList>['sections'];
  bottomPadding: number;
}

export function CampusSheetBody({ sections, bottomPadding }: CampusSheetBodyProps) {
  const styles = useStyles();

  // WHY: a re-tap on the map tab at its root scrolls to top and leaves the sheet at its level (ADR 0023 d3).
  const scrollRef = useRef<BottomSheetScrollViewMethods>(null);
  const scrollToTop = useCallback(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), []);
  useScrollToTopOnRetap('campus', scrollToTop);

  // WHY: stays mounted when the feed is empty; it gives the sheet its content pane and keeps the drag gesture.
  return (
    <Sheet.ScrollView
      ref={scrollRef}
      style={styles.sheetContent}
      contentContainerStyle={[styles.sheetFeed, { paddingBottom: bottomPadding }]}
    >
      <SduiSectionList sections={sections} />
    </Sheet.ScrollView>
  );
}

const useStyles = createThemedStyles(() => ({
  sheetContent: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  sheetFeed: {
    // WHY: the column's only horizontal gutter, measured from the card's edge; the widgets carry none.
    paddingHorizontal: SdsSpacing.x4,
    paddingTop: SdsSpacing.x2,
  },
}));
