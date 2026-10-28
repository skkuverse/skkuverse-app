import type { ActionType, Campus, I18nText, LatLng, PlaceKind } from '@skkuverse/shared';
import type { LayerLens } from './map-config.types';


/**
 * WHY: `placeId` is a string for every kind, one addressing scheme; a `chip` tap stands for a whole list and
 * opens no sheet. `bus_stop` is never served: transit builds it on the pins a sheet publishes.
 */
export type MarkerTap =
  | { kind: 'skku_building'; placeId: string }
  | { kind: 'event'; placeId: string }
  | { kind: 'chip'; chipId: string }
  | { kind: 'bus_stop'; placeId: string; line?: { groupId: string; stationIndex: number } };

export type LocationAccuracy = 'exact' | 'area';

/**
 * WHY: the start is always real and gates the window; a `null` end is unannounced, never "no limit", so
 * `hours: []` stays the one spelling of always open. `label` names a window when they differ.
 */
export interface OpeningWindow {
  startAt: string;
  endAt: string | null;
  label: I18nText | null;
}

export interface MarkerField {
  label: I18nText;
  value: I18nText;
}

/**
 * WHY: a `webview` value is resolved to an absolute URL server-side, since a relative string handed to a URL
 * opener is an open redirect; `route` stays root-relative for the app's own navigator.
 */
export interface MarkerAction {
  id: string;
  label: I18nText;
  actionType: ActionType;
  actionValue: string;
  style?: 'primary' | 'secondary';
}

/** WHY: no geometry here; it is the one thing that differs between the arms of `MapOverlay`. */
interface OverlayBase {
  /** WHY: unique within its layer, not across layers, so the React key is `layerId` plus this. */
  id: string;
  /** WHY: layers share endpoints, so this is the filter. */
  layerId: string;
  campus: Campus;
  /** WHY: every language the server holds, not the `Accept-Language` one, since a booth title may carry `zh`. */
  text: I18nText;
  subtitle: I18nText | null;
  /** WHY: empty means always open, and only that; a cancelled place is not served, and no `status` rides the wire. */
  hours: OpeningWindow[];
  fields: MarkerField[];
  actions: MarkerAction[];
  order: number;
  facets: Record<string, string[]>;
  orderByOption: Record<string, number>;
  /** WHY: `null` is a backdrop, drawn and not pressable; a renderer must not wire `onTap` for it. */
  tap: MarkerTap | null;
}

/**
 * CONTRACT(skkuverse-server): skkuverse-server/docs/reference/map-overlays-api.md §2.3. WHY: `kind` is an open
 * enum and the server reserves more; an unknown overlay drops alone, so never assert `never` over this union,
 * which would blank a layer on a shipped build.
 */
export type MapOverlay =
  | (OverlayBase & {
      kind: 'marker';
      /** WHY: flat scalars, so `PinCandidate` matches and `tsc` refuses a polygon to `resolvePinCollisions`. */
      lat: number;
      lng: number;
      /** WHY: on this arm alone, so two overlapping zones can never be a collision to resolve. */
      pinPriority: number;
      /** WHY: a fact, not an instruction; what follows from it is this app's decision. */
      locationAccuracy: LocationAccuracy;
    })
  | (OverlayBase & {
      kind: 'polygon';
      /** WHY: wound per RFC 7946 as it arrives; the SDK's reversal belongs to the renderer (`overlay-geometry.rules.ts`). */
      rings: LatLng[][];
    })
  | (OverlayBase & {
      kind: 'path';
      line: LatLng[];
    });

/** WHY: `Extract`, not a restated interface, so widening `OverlayBase` cannot leave the two out of step. */
export type MarkerOverlay = Extract<MapOverlay, { kind: 'marker' }>;



/** WHY: stops are their own category, not mixed with buildings (ADR 0022 d4). */
export interface MapPlace {
  id: string;
  name: I18nText;
  coords: LatLng | null;
  layers: LayerLens;
}

/** WHY: the map feature does not fetch `/bus` or `/subway`. */
export type FedPlaceKind = Extract<PlaceKind, 'bus_stop' | 'subway_station'>;
