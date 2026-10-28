import { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { pickI18nText, SdsSpacing, useT } from '@skkuverse/shared';
import { Sheet, SheetCloseButton, Txt } from '@skkuverse/sds';
import { track } from '@/platform/analytics';
import { InstagramInlineButton } from './components/PlaceActionsRow';
import { PlaceSheetScroll } from './components/PlaceSheetScroll';
import { soleInstagram } from './place-detail.rules';
import { usePlaceSheet } from './usePlaceSheet';
import type { MapSheetViewProps } from '../sheet-views.types';
import { useAppLanguage } from '../useAppLanguage';
import { useMapLayout } from '../useMapLayout';
import { useMapTask } from '../useMapTask';
import { SHEET_CONTENT_BOTTOM } from '../sheet-detents.constants';

export function PlaceSheetBody({ tab, entry, sheet }: MapSheetViewProps<'event'>) {
  const { t } = useT();
  const lang = useAppLanguage();
  const layout = useMapLayout();
  const { pop } = useMapTask(tab);
  const { place, detail, now, gone } = usePlaceSheet(entry);

  useEffect(() => {
    if (gone) pop();
  }, [gone, pop]);

  const { dismiss, dismissAction } = sheet;
  const handleClose = useCallback(() => {
    track('item_action', { view: 'place_sheet', item_id: entry.request.placeId, action: dismissAction });
    dismiss();
  }, [dismiss, dismissAction, entry.request.placeId]);

  const instagram = place ? soleInstagram(place.actions, detail?.actions ?? []) : null;

  return (
    <>
      <View style={styles.header}>
        {place ? (
          <View style={styles.headerTitle}>
            <Txt typography="t7" fontWeight="bold" color="neutral" numberOfLines={2}>
              {pickI18nText(place.text, lang)}
            </Txt>
            {instagram ? <InstagramInlineButton action={instagram} /> : null}
          </View>
        ) : null}
        <SheetCloseButton label={t('common.close')} onPress={handleClose} />
      </View>
      {place ? (
        <PlaceSheetScroll
          place={place}
          detail={detail}
          now={now}
          bottomPadding={SHEET_CONTENT_BOTTOM + layout.sheetContentBottom}
        />
      ) : (
        <Sheet.ScrollView style={styles.empty}>{null}</Sheet.ScrollView>
      )}
    </>
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
