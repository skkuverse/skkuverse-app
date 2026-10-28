import { useT } from '@skkuverse/shared';
import { CampusSheetBody } from './components/CampusSheetBody';
import { MapSheetStack } from './MapSheetStack';
import { useMapTab } from './useMapTab';

export function MapTabScreen({ legacySheet = false }: { legacySheet?: boolean }) {
  const { t } = useT();
  const {
    sheetPosition,
    sections,
    sheetContentBottom,
  } = useMapTab();

  return (
    <MapSheetStack
      tab="map"
      root={{
        profile: 'campusRoot',
        legacyPosition: legacySheet ? sheetPosition : undefined,
        label: t('map.sheet.a11y.root'),
        body: (
          <CampusSheetBody
            sections={sections}
            bottomPadding={sheetContentBottom}
          />
        ),
      }}
    />
  );
}
