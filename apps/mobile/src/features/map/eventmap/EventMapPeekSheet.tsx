import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { pickI18nText, SdsSpacing, useT } from '@skkuverse/shared';
import {
  GLASS_AVAILABLE,
  Sheet,
  SheetCloseButton,
  SHEET_HANDOFF_RISE,
  Txt,
  type SheetPosition,
} from '@skkuverse/sds';
import { InstagramInlineButton } from './components/PlaceActionsRow';
import { PlaceSheetScroll } from './components/PlaceSheetScroll';
import { trackPlaceAction } from './components/usePlaceNavigate';
import { placeSheetOpensTall, soleInstagram } from './place-detail.rules';
import { usePlaceSheet } from './usePlaceSheet';
import type { MapSheetCardProps } from '../sheet-views.types';
import { useAppLanguage } from '../useAppLanguage';
import { SHEET_CONTENT_BOTTOM } from '../sheet-detents.constants';

const DETENTS = ['small', 'large'] as const;
/**
 * WHY: every place opens at the standard collapsed card, however short; one kind of sheet at two heights
 * reads as two sheets. The top detent stays `large`, which makes this sheet crossfade.
 */
const POSITION: SheetPosition = { kind: 'expandable', detents: DETENTS };
/** WHY: an area-only pin has nothing to keep in view, so the sheet opens tall; still draggable down. */
const POSITION_TALL: SheetPosition = { kind: 'expandable', detents: DETENTS, initial: 'large' };

export function EventMapPeekSheet({ entry, sheetRef, bottomGap, onDismiss, onGone, onNavigateAway }: MapSheetCardProps<'event'>) {
  const { t } = useT();
  const lang = useAppLanguage();
  const insets = useSafeAreaInsets();
  const { place, detail, now, gone } = usePlaceSheet(entry);

  // WHY: the dismiss report drops the entry as the user's own swipe would, but returns to no page.
  useEffect(() => {
    if (!gone) return;
    onGone();
    sheetRef.current?.dismiss?.();
  }, [gone, sheetRef, onGone]);

  // WHY: with glass, `bottomGap` already clears the home indicator; without it the opaque sheet runs under the
  // edge-to-edge navigation bar and clears that bar alone.
  const bottomPadding = SHEET_CONTENT_BOTTOM + (GLASS_AVAILABLE ? bottomGap : insets.bottom);
  const instagram = place ? soleInstagram(place.actions, detail?.actions ?? []) : null;

  // WHY: a sheet that opens tall reports its first detent with nothing before it, which is not a pull.
  const lastIndex = useRef(-1);
  const onChange = (index: number) => {
    const top = DETENTS.length - 1;
    if (index === top && lastIndex.current >= 0 && lastIndex.current < top) trackPlaceAction('expand');
    lastIndex.current = index;
  };

  return (
    <Sheet
      ref={sheetRef}
      // WHY: the campus sheet steps aside before this rises (`sheet-handoff.rules.ts`); read on each present, since
      // the modal mounts afresh every time.
      position={placeSheetOpensTall(place) ? POSITION_TALL : POSITION}
      surface="glass"
      bottomGap={bottomGap}
      // WHY: the default 'switch' minimizes the building card and restores it on close, resurfacing a sheet unasked.
      stackBehavior="replace"
      // WHY: it rises only after the campus sheet has gone down, so it arrives on a short timing.
      animationConfigs={SHEET_HANDOFF_RISE}
      onChange={onChange}
      onDismiss={() => {
        lastIndex.current = -1;
        onDismiss();
      }}
    >
      <View style={styles.header}>
        {place ? (
          <View style={styles.headerTitle}>
            <Txt typography="t7" fontWeight="bold" color="neutral" numberOfLines={2}>
              {pickI18nText(place.text, lang)}
            </Txt>
            {instagram ? <InstagramInlineButton action={instagram} /> : null}
          </View>
        ) : null}
        <SheetCloseButton label={t('common.close')} />
      </View>
      {place ? (
        <PlaceSheetScroll
          place={place}
          detail={detail}
          now={now}
          bottomPadding={bottomPadding}
          onNavigateAway={onNavigateAway}
        />
      ) : (
        <Sheet.ScrollView style={styles.empty}>{null}</Sheet.ScrollView>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SdsSpacing.x2,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: SdsSpacing.gutter,
    paddingBottom: SdsSpacing.x2,
  },
  headerTitle: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: SdsSpacing.x2,
    rowGap: SdsSpacing.x1,
    paddingTop: SdsSpacing.x1,
  },
  empty: { flex: 1 },
});
