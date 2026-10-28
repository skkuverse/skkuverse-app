/**
 * WHY: two tables, because the shells present a place differently and no feature file may read the shell;
 * `MapSheetCards` spreads after `MapSheetViews` to keep the native-tab shell unchanged.
 */

import { BuildingDetailSheet } from './building/BuildingDetailSheet';
import { BuildingSheetBody, BuildingSheetTracking } from './building/BuildingSheetBody';
import { EventListSheet, EventListSheetTracked, EventListTracking } from './eventmap/EventListSheet';
import { EventMapPeekSheet } from './eventmap/EventMapPeekSheet';
import { PlaceSheetBody } from './eventmap/PlaceSheetBody';
import { toMapSheetKey } from './map-task.rules';
import type { MapSheetViewTable } from './sheet-views.types';

const EVENT_LIST = { presentation: 'swap', profile: 'list', label: 'map.sheet.a11y.list', keyOf: toMapSheetKey } as const;

export const MapSheetViews = {
  skku_building: {
    presentation: 'swap',
    View: BuildingSheetBody,
    profile: 'place',
    label: 'map.sheet.a11y.building',
    keyOf: toMapSheetKey,
    Tracking: BuildingSheetTracking,
  },
  // WHY: the event place logs its own view in both shells, so it has no `Tracking`.
  event: {
    presentation: 'swap',
    View: PlaceSheetBody,
    profile: 'peek',
    label: 'map.sheet.a11y.place',
    openingOf: (request) => (request.area ? 'max' : 'min'),
    keyOf: toMapSheetKey,
  },
  chip: { ...EVENT_LIST, View: EventListSheet, Tracking: EventListTracking },
} satisfies Partial<MapSheetViewTable>;

export const MapSheetCards = {
  skku_building: { presentation: 'over', View: BuildingDetailSheet, keyOf: toMapSheetKey },
  event: { presentation: 'over', View: EventMapPeekSheet, keyOf: toMapSheetKey },
  // WHY: logged per mount, since an entry's `Tracking` would count a list another chip swapped out as still open.
  chip: { ...EVENT_LIST, View: EventListSheetTracked },
} satisfies Partial<MapSheetViewTable>;
