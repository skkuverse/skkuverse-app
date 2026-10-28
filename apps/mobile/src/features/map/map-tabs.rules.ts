import type { TabRoute } from '@skkuverse/shared';
import type { MapTabId } from './map-config.types';
import { MAP_TAB_OF_ROUTE } from './map-tabs.constants';

export function tabRouteOf(tab: MapTabId): TabRoute {
  switch (tab) {
    case 'map':
      return 'campus';
    case 'transit':
      return 'transit';
  }
}

export function mapTabOf(route: TabRoute): MapTabId | null {
  return MAP_TAB_OF_ROUTE[route];
}
