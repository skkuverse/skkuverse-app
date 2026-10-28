// CONTRACT(skkuverse-server): skkuverse-server/docs/reference/subway-api.md
// The server picks the best time it has for each train, so the client reads only what it shows.

import type { Campus, LatLng, SubwayDirectionKey } from '@skkuverse/shared';
import type { ArrivalStatus, CallBasis } from '../transit.types';

export interface SubwayTrain {
  /** WHY: four digits, unique within a direction, so it is the list key. */
  trainNo: string;
  // WHY: always Korean whatever the request language.
  headsign: string;
  isExpress: boolean;
  // WHY: the expected arrival, else the timetable's arrival, else its departure (a train's origin has no arrival).
  arrivalAt: number;
  basis: CallBasis;
  status: ArrivalStatus;
  // CONTRACT(skkuverse-server): skkuverse-server/docs/reference/subway-api.md
  // 0 standing here, 1 approaching here or at/leaving the previous station, k approaching the (k-1)th before; null when unseen or farther.
  stopsAway: number | null;
  // WHY: the first train of its service day (03:00 to 03:00 KST) through this station in this direction; false when unsaid.
  isFirstRun: boolean;
  isLastRun: boolean;
  // WHY: false for an express seen upstream short of approaching (the count skips platforms it passes, so it would
  // draw closer than it is) and for a train that has left; its row and countdown stay.
  onTrack: boolean;
}

export interface SubwayDirection {
  direction: SubwayDirectionKey;
  name: string;
  nextStationName: string | null;
  trains: SubwayTrain[];
}

export interface SubwayLineMarker {
  text: string;
  // WHY: chosen for 4.5:1 on the light row, so darker than the line's `color`; dark mode lifts it (`legibleOn`).
  color: string;
}

// WHY: the app keeps no line table of its own; the server draws every line.
export interface SubwayLine {
  /** WHY: the key a `line` query param names. */
  code: string;
  name: string;
  // WHY: the line's true color, which the track draws; six hex digits, no '#'.
  color: string;
  marker: SubwayLineMarker;
}

export interface SubwayLineArrivals {
  line: SubwayLine;
  directions: SubwayDirection[];
}

export interface SubwayArrivals {
  stationId: string;
  stationName: string;
  coords: LatLng | null;
  // WHY: empty only while the server deploys; the screen says no trains.
  lines: SubwayLineArrivals[];
}

export interface SubwayStation {
  id: string;
  title: string;
  // WHY: null for a campus this build does not know, which reads the same as none.
  campus: Campus | null;
  lines: SubwayLine[];
  coords: LatLng | null;
}

export interface SubwayArrivalsMeta {
  // QUIRK(skkuverse-server): a server that predates `meta.serverNow` omits it.
  serverNowMs?: number;
}

export interface SubwayArrivalsAnswer extends SubwayArrivals, SubwayArrivalsMeta {
  // WHY: a body the HTTP cache replays keeps the arrival time of the one it copies (`receiptOf`).
  receivedAtMs: number;
}
