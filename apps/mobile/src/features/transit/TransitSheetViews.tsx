/**
 * WHY: composed in `bootstrap/SharedMapShell.tsx`, so no map file names a transit component
 * and the runtime edge stays transit to map.
 */

import type { MapSheetViewTable } from '@/features/map/sheet-views.types';
import { toStationRequest, toStopRequest, toTransitSheetKey } from './map-lens.rules';
import { LineSheet } from './realtime/LineSheet';
import { LineSheetTracking } from './realtime/LineSheetTracking';
import { StopSheet, StopSheetTracking } from './stop/StopSheet';
import { StationSheet, StationSheetTracking } from './subway/StationSheet';

export const TransitSheetViews = {
  line: {
    presentation: 'swap',
    View: LineSheet,
    profile: 'route',
    label: 'transit.sheet.a11y.line',
    keyOf: toTransitSheetKey,
    Tracking: LineSheetTracking,
  },
  bus_stop: {
    presentation: 'swap',
    View: StopSheet,
    profile: 'stop',
    label: 'transit.sheet.a11y.stop',
    keyOf: toTransitSheetKey,
    fromPlace: toStopRequest,
    layersFromFeed: true,
    Tracking: StopSheetTracking,
  },
  subway_station: {
    presentation: 'swap',
    View: StationSheet,
    profile: 'stop',
    label: 'transit.sheet.a11y.station',
    keyOf: toTransitSheetKey,
    fromPlace: toStationRequest,
    Tracking: StationSheetTracking,
  },
} satisfies Partial<MapSheetViewTable>;
