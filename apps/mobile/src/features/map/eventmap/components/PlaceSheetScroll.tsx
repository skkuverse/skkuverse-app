/** WHY: nothing here reads the detent; collapsed shows as much as fits (SEE: docs/explanation/bottom-sheet-system.md). */

import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import type { BottomSheetScrollViewMethods } from '@gorhom/bottom-sheet';
import {
  SdsSpacing,
} from '@skkuverse/shared';
import { Sheet } from '@skkuverse/sds';
import { SHEET_GUTTER } from './sheet-layout.constants';
import { PlaceSummary } from './PlaceSummary';
import { FactsSection } from './FactsSection';
import { PlaceBlocks } from './PlaceBlocks';
import { placeSections, type PlaceSectionKey } from '../place-detail.rules';
import type { PlaceDetail } from '../place-detail.types';
import type { MapOverlay } from '../../overlay.types';

export function placeIdOf(place: MapOverlay): string {
  return place.tap?.kind === 'event' ? place.tap.placeId : place.id;
}

interface PlaceSheetScrollProps {
  place: MapOverlay;
  detail: PlaceDetail | null;
  now: number;
  bottomPadding: number;
  onNavigateAway?: () => void;
}

export function PlaceSheetScroll({
  place,
  detail,
  now,
  bottomPadding,
  onNavigateAway,
}: PlaceSheetScrollProps) {
  const placeId = placeIdOf(place);

  const sections = useMemo(() => placeSections(detail), [detail]);

  const scrollRef = useRef<BottomSheetScrollViewMethods>(null);

  // WHY: another pin tapped while the sheet is up starts the new place from the top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [placeId]);

  return (
    <Sheet.ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
    >
      <PlaceSummary
        place={place}
        detail={detail}
        now={now}
        onNavigateAway={onNavigateAway}
      />

      <View style={styles.sections}>
        {sections.map((section) => (
          <PlaceSection
            key={section}
            section={section}
            place={place}
            detail={detail}
            onNavigateAway={onNavigateAway}
          />
        ))}
      </View>
    </Sheet.ScrollView>
  );
}

function PlaceSection({
  section,
  place,
  detail,
  onNavigateAway,
}: {
  section: PlaceSectionKey;
  place: MapOverlay;
  detail: PlaceDetail | null;
  onNavigateAway?: () => void;
}) {
  if (section === 'facts') return <FactsSection place={place} detail={detail} />;
  return detail === null ? null : <PlaceBlocks blocks={detail.blocks} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' },
  content: { paddingHorizontal: SHEET_GUTTER },
  sections: { gap: SdsSpacing.x6 },
});
