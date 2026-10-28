import { MapHost } from './MapHost';
import { MapSheetCards, MapSheetViews } from './MapSheetViews';
import { MapTabScreen } from './MapTabScreen';
import type { MapSheetViewTable } from './sheet-views.types';

const SHEET_VIEWS = { ...MapSheetViews, ...MapSheetCards } satisfies Partial<MapSheetViewTable>;

export function NativeMapScreen() {
  return (
    // CONTRACT(skkuverse-server): skkuverse-server/docs/reference/map-overlays-api.md §8.9; `all` shows every
    // served layer and chip.
    <MapHost sheetViews={SHEET_VIEWS} tabScope="all" tab="map">
      {/* WHY: the native tabs keep today's sheet heights until the owner signs off on the detent scale. */}
      <MapTabScreen legacySheet />
    </MapHost>
  );
}
