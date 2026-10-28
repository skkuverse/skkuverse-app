import { useCallback, useRef } from 'react';
import { View } from 'react-native';
import type { BottomSheetScrollViewMethods } from '@gorhom/bottom-sheet';
import { Sheet, TextButton, Txt, createThemedStyles } from '@skkuverse/sds';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { useScrollToTopOnRetap } from '@/components/useScrollToTopOnRetap';
import { useThisWeek } from '../useThisWeek';
import type { ThisWeekWeekId } from '../this-week.types';
import { FeedEmpty } from './FeedEmpty';
import { FeedSections } from './FeedSections';

export function ThisWeekSheet() {
  const styles = useStyles();
  const vm = useThisWeek();

  // WHY: a re-tap on the map tab at its root scrolls to top and leaves the sheet at its level (ADR 0023 d3).
  const scrollRef = useRef<BottomSheetScrollViewMethods>(null);
  const scrollToTop = useCallback(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), []);
  useScrollToTopOnRetap('campus', scrollToTop);

  return (
    <Sheet.ScrollView ref={scrollRef} style={styles.sheet} contentContainerStyle={[styles.content, { paddingBottom: vm.bottomPadding }]}>
      {vm.isEmpty ? <FeedEmpty onOpenNotices={vm.onOpenNotices} /> : <FeedSections sections={vm.sections} onOpenRow={vm.onOpenRow} />}
      {vm.hasMore ? (
        <TextButton typography="t4" fontWeight="medium" color="neutralMuted" variant="arrow" onPress={vm.onMore} style={styles.more}>
          {vm.moreLabel}
        </TextButton>
      ) : null}
      {vm.weeks.length > 0 ? <DevWeekSwitch weeks={vm.weeks} weekId={vm.weekId} onWeek={vm.onWeek} /> : null}
    </Sheet.ScrollView>
  );
}

/** WHY: drawn as a dev tool, never a product filter; the words are a developer's, so they stay out of i18n. */
function DevWeekSwitch({
  weeks,
  weekId,
  onWeek,
}: {
  weeks: readonly { id: ThisWeekWeekId; label: string }[];
  weekId: ThisWeekWeekId;
  onWeek: (id: ThisWeekWeekId) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.dev}>
      <Txt typography="t1" fontWeight="bold" color="neutralSubtle">
        DEV
      </Txt>
      {weeks.map((week) => {
        const selected = week.id === weekId;
        return (
          <TextButton
            key={week.id}
            typography="t2"
            fontWeight={selected ? 'bold' : 'regular'}
            color={selected ? 'neutral' : 'neutralSubtle'}
            variant={selected ? 'underline' : 'clear'}
            onPress={() => onWeek(week.id)}
            style={styles.devWeek}
          >
            {week.label}
          </TextButton>
        );
      })}
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  sheet: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingTop: SdsSpacing.x2,
    gap: SdsSpacing.x2,
  },
  // WHY: a 44pt target around one line of t4 (A11Y-04).
  more: {
    alignSelf: 'center',
    paddingVertical: SdsSpacing.x3,
    paddingHorizontal: SdsSpacing.x4,
  },
  dev: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x2,
    marginTop: SdsSpacing.x6,
    paddingHorizontal: SdsSpacing.x2_5,
    paddingVertical: SdsSpacing.x1,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.stroke.neutralWeak,
    borderRadius: SdsRadius.r1_5,
  },
  devWeek: {
    paddingVertical: SdsSpacing.x1,
  },
}));
