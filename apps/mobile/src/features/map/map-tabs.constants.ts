import type { TabRoute } from '@skkuverse/shared';
import type { MapTabId } from './map-config.types';
import type { MapSheetKind } from './sheet-stack.types';

export const MAP_TAB_OF_ROUTE: Readonly<Record<TabRoute, MapTabId | null>> = {
  home: null,
  notices: null,
  campus: 'map',
  transit: 'transit',
};

export const SHEET_KIND_HOME_TAB: Readonly<Record<MapSheetKind, MapTabId>> = {
  skku_building: 'map',
  event: 'map',
  chip: 'map',
  line: 'transit',
  bus_stop: 'transit',
  subway_station: 'transit',
};
