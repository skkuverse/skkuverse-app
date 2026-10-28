/**
 * WHY: at the feature root because the line, stop and station sheets all read it, and a sub-feature may not import a sibling's file.
 */

import type { Campus, I18nText, LatLng, MapPlaceRef } from '@skkuverse/shared';
import { FOCUSED_PLACE_LAYER } from '@/features/map/map.constants';
import type { MapCameraMotion, MapChipCamera, MapLayerDef } from '@/features/map/map-config.types';
import type { MapOverlay, MapPlace } from '@/features/map/overlay.types';
import type { TaskOverlay } from '@/features/map/sheet-stack.types';
import type { TaskOverlayRole } from '@/features/map/sheet-stack.constants';
import type { MapSheetPlace } from '@/features/map/sheet-views.types';
import type { EntrySource } from '@/platform/analytics.rules';
import type { SubwayStation } from './subway/subway.types';
import type { BusStop, LineStation, RealtimeDirection, TransitSheetRequest, TransitSheetRequestOf } from './transit.types';
import { STOP_FOCUS_ZOOM } from '@/features/map/camera.constants';

// WHY: the served route layer is `<groupId>_route`, and the lens names it only when the config holds it.
export function toRouteLayers(
  groupIds: readonly string[],
  layers: readonly Pick<MapLayerDef, 'id'>[],
): Record<string, boolean> {
  const served = new Set(layers.map((l) => l.id));
  const lens: Record<string, boolean> = {};
  for (const groupId of groupIds) {
    const id = `${groupId}_route`;
    if (served.has(id)) lens[id] = true;
  }
  return lens;
}

export function toStopCamera(coords: LatLng, motion: MapCameraMotion): MapChipCamera {
  return { ...motion, zoom: STOP_FOCUS_ZOOM, lat: coords.lat, lng: coords.lng };
}

export function toStopPins(
  groupId: string,
  stations: readonly LineStation[],
  towardsLabel: (name: string) => string,
  routeColor?: string,
): TaskOverlay[] {
  const pins: TaskOverlay[] = [];
  for (const { station, stopId, name, coords, campus, towards } of stations) {
    if (!coords || !stopId) continue;
    pins.push({
      ...placePin({
        role: 'stop',
        id: stopId,
        layerId: `${groupId}_stops`,
        campus,
        text: name ?? { ko: station.name, en: station.name },
        subtitle: towards && mapText(towards, towardsLabel),
        order: station.index,
        coords,
        tap: { kind: 'bus_stop', placeId: stopId, line: { groupId, stationIndex: station.index } },
      }),
      ...(routeColor !== undefined && { color: routeColor }),
    });
  }
  return pins;
}

export function toDirectionLabels(
  groupId: string,
  directions: readonly RealtimeDirection[],
  stations: readonly LineStation[],
): TaskOverlay[] {
  const labels: TaskOverlay[] = [];
  directions.forEach((direction, order) => {
    const run = stations.filter(
      (s) => s.coords && s.stopId && s.station.index >= direction.fromIndex && s.station.index <= direction.toIndex,
    );
    const middle = run[Math.floor(run.length / 2)];
    if (!middle?.coords) return;
    labels.push(
      placePin({
        role: 'directionLabel',
        id: `${groupId}:direction:${direction.id}`,
        layerId: `${groupId}_directions`,
        campus: middle.campus,
        text: { ko: direction.label, en: direction.label },
        subtitle: null,
        order,
        coords: middle.coords,
        tap: null,
      }),
    );
  });
  return labels;
}

export function toFocusedPlacePin(place: { id: string; name: string; coords: LatLng; campus?: Campus | null }): TaskOverlay {
  return placePin({
    role: 'focusedPlace',
    id: place.id,
    layerId: FOCUSED_PLACE_LAYER,
    campus: place.campus ?? null,
    text: { ko: place.name, en: place.name },
    subtitle: null,
    order: 0,
    coords: place.coords,
    tap: null,
  });
}

function mapText(text: I18nText, f: (s: string) => string): I18nText {
  return { ko: f(text.ko), en: f(text.en), ...(text.zh !== undefined && { zh: f(text.zh) }) };
}

interface PlacePinInputs {
  role: TaskOverlayRole;
  id: string;
  layerId: string;
  campus: Campus | null;
  text: MapOverlay['text'];
  subtitle: MapOverlay['subtitle'];
  order: number;
  coords: LatLng;
  tap: MapOverlay['tap'];
}

/**
 * WHY: a stop with no campus falls to `hssc`; every realtime line runs there today and an overlay must name a campus.
 */
function placePin({ role, id, layerId, campus, text, subtitle, order, coords, tap }: PlacePinInputs): TaskOverlay {
  return {
    kind: 'marker',
    role,
    id,
    layerId,
    campus: campus ?? 'hssc',
    text,
    subtitle,
    hours: [],
    fields: [],
    actions: [],
    order,
    facets: {},
    orderByOption: {},
    tap,
    lat: coords.lat,
    lng: coords.lng,
    pinPriority: 0,
    locationAccuracy: 'exact',
  };
}

export function toStopRequest(place: MapSheetPlace): TransitSheetRequestOf<'bus_stop'> {
  return { kind: 'bus_stop', stopId: place.placeId, source: place.source, ...(place.line && { line: place.line }) };
}

export function toStationRequest(place: MapSheetPlace): TransitSheetRequestOf<'subway_station'> {
  return { kind: 'subway_station', stationId: place.placeId, source: place.source };
}

// WHY: the source and the line a stop was opened from are not part of a sheet's identity.
export function toTransitSheetKey(request: TransitSheetRequest): string {
  switch (request.kind) {
    case 'line':
      return `line:${request.groupId}`;
    case 'bus_stop':
      return `bus_stop:${request.stopId}`;
    case 'subway_station':
      return `subway_station:${request.stationId}`;
  }
}

export function toTransitPlaceRequest(ref: MapPlaceRef & { source?: EntrySource }): TransitSheetRequest | null {
  const place = { placeId: ref.placeId, source: ref.source ?? 'deeplink' };
  switch (ref.kind) {
    case 'bus_stop':
      return toStopRequest(place);
    case 'subway_station':
      return toStationRequest(place);
    case 'skku_building':
    case 'event':
    case null:
      return null;
  }
}

export function toStopPlaces(stops: readonly BusStop[], layers: readonly Pick<MapLayerDef, 'id'>[]): MapPlace[] {
  return stops.map(({ id, name, coords, routes }) => ({
    id,
    name,
    coords,
    layers: toRouteLayers(
      routes.map((r) => r.groupId),
      layers,
    ),
  }));
}

export function toStationPlaces(stations: readonly SubwayStation[]): MapPlace[] {
  return stations.flatMap(({ id, title, coords }) =>
    coords
      ? [
          {
            id,
            // WHY: the list follows Accept-Language, so the one title it serves stands for every language.
            name: { ko: title, en: title, zh: title },
            coords,
            layers: {},
          },
        ]
      : [],
  );
}

export function stopRouteLayers(
  stops: readonly BusStop[] | undefined,
  stopId: string,
  fallbackGroupId: string,
  layers: readonly Pick<MapLayerDef, 'id'>[],
): Record<string, boolean> {
  const stop = stops?.find((s) => s.id === stopId);
  return toRouteLayers(stop ? stop.routes.map((r) => r.groupId) : [fallbackGroupId], layers);
}

// EVIDENCE: a served path overshoots the stops' box by up to 86 m a side on the live lines.
export function routeFramePoints(
  overlays: readonly MapOverlay[] | undefined,
  groupId: string,
  stations: readonly LineStation[],
): readonly (LatLng | null)[] {
  const path = overlays?.find(
    (o): o is Extract<MapOverlay, { kind: 'path' }> => o.kind === 'path' && o.layerId === `${groupId}_route`,
  );
  return path ? path.line : stations.map((s) => s.coords);
}

// WHY: a line's two directions stop at distinct poles, and both drawn at once make a double column of pins.
export function directionOnMap(directions: readonly RealtimeDirection[], selectedId: string | null): RealtimeDirection | null {
  if (directions.length < 2) return null;
  return directions.find((d) => d.id === selectedId) ?? null;
}

export interface LineMapInputs {
  groupId: string;
  stations: readonly LineStation[];
  directions: readonly RealtimeDirection[];
  selectedDirectionId: string | null;
  towardsLabel: (name: string) => string;
  routeColor?: string;
}

export function lineMapOverlays({
  groupId,
  stations,
  directions,
  selectedDirectionId,
  towardsLabel,
  routeColor,
}: LineMapInputs): TaskOverlay[] {
  const shown = directionOnMap(directions, selectedDirectionId);
  const onMap = shown
    ? stations.filter((s) => s.station.index >= shown.fromIndex && s.station.index <= shown.toIndex)
    : stations;
  return [
    ...toStopPins(groupId, onMap, towardsLabel, routeColor),
    ...toDirectionLabels(groupId, shown ? [shown] : directions, stations),
  ];
}
