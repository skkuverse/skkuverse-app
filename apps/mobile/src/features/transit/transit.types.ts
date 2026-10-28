import type { ActionType, Campus, I18nText, LatLng, TransitGroupState } from '@skkuverse/shared';
import type { EntrySource } from '@/platform/analytics.rules';
import type { SubwayLineMarker } from './subway/subway.types';

/** WHY: the map's `MapSheetRequest` names this type with `import type` alone, so the runtime edge stays transit to map. */
export type TransitSheetRequest =
  | { kind: 'line'; groupId: string; source: EntrySource }
  | {
      kind: 'bus_stop';
      stopId: string;
      source: EntrySource;
      line?: { groupId: string; stationIndex: number };
    }
  | { kind: 'subway_station'; stationId: string; line?: string; source: EntrySource };
export type TransitSheetRequestOf<K extends TransitSheetRequest['kind']> = Extract<TransitSheetRequest, { kind: K }>;

export type BusGroupVisibility =
  | { type: 'always' }
  | { type: 'dateRange'; from: string; until: string };

export interface BusGroupCard {
  /** WHY: hex digits, no '#'. */
  themeColor: string;
  iconType: string;
  busTypeText: string;
}

export interface TransferLine {
  line: string;
  /** WHY: hex digits, no '#'. */
  color: string;
}

export interface RealtimeStation {
  index: number;
  name: string;
  subtitle?: string;
  stationNumber?: string;
  /** WHY: optional so a server before the field still parses. */
  directionId?: string;
  isFirstStation: boolean;
  isLastStation: boolean;
  isRotationStation: boolean;
  /** WHY: a pass-through row says so and shows no arrival. */
  isPassThrough: boolean;
  /** WHY: the flag, never the stop's name, says riders may only get off here. */
  isAlightOnly: boolean;
  /** WHY: opaque, never built from the station number. Absent means no stop page. */
  stopId?: string;
  transferLines: TransferLine[];
}

export interface RealtimeDirection {
  id: string;
  label: string;
  fromIndex: number;
  toIndex: number;
}

export interface RealtimeScreenConfig {
  /** WHY: optional so a server before the field still parses. */
  liveEndpoint?: string;
  /** WHY: empty from a server before the field. */
  directions: RealtimeDirection[];
  refreshInterval: number;
  lastStationIndex: number;
  /** WHY: past the last station a loop line drives back to station 0, so that station is no terminus. */
  isLoop: boolean;
  /** WHY: false means the source never names a plate, so the marker shows none. */
  hasPlates: boolean;
  /** WHY: false, or a server before the field, marks no bus low-floor. */
  hasLowFloor: boolean;
  stations: RealtimeStation[];
  features: Record<string, unknown>[];
}

export type StopAction = 'board' | 'alight';
export type StopTiming = 'scheduled' | 'estimated';

export interface SequenceStop {
  label: string;
  action: StopAction;
  timing: StopTiming;
  /** WHY: the parser drops a sequence stop whose `stopId` names no stop of `screen.stops`. */
  stopId?: string;
  detail?: string;
  note?: string;
}

/** WHY: the parser drops a marker kind it does not know, so the server can add kinds without a release. */
export interface StopMapMarker {
  id: string;
  kind: 'subwayExit';
  label: string;
  number: number;
  coords: LatLng;
}

/** WHY: one end is the reserved id "stop", the other a marker id whose marker the parser may have dropped. */
export interface StopMapPath {
  kind: 'walk';
  from: string;
  to: string;
  /** WHY: at least two points; the first is `from`'s position, the last `to`'s. */
  points: LatLng[];
}

export interface StopMap {
  markers: StopMapMarker[];
  paths: StopMapPath[];
}

export interface BoardingStop {
  id: string;
  name: string;
  detail?: string;
  coords?: LatLng;
  photoUrl?: string;
  /** WHY: the client opens the link as served and never builds it. */
  streetViewUrl?: string;
  /** WHY: only ever set with `coords`. */
  map?: StopMap;
  /** WHY: shown as served, never built here. */
  subwayStation?: { id: string; title: string };
}

export type ServiceSelector = 'segmented' | 'chips';

/** WHY: an open enum on the wire; the parser drops a target it does not know. */
export type RefreshTarget = 'traffic' | 'crowding';

export interface ServiceRefresh {
  /** WHY: a refresh with no known target is parsed as absent. */
  targets: RefreshTarget[];
  /** WHY: the parser defaults and floors the interval. */
  intervalSec: number;
}

export interface BusService {
  serviceId: string;
  label: string;
  endpoint: string;
  /** WHY: absent for a service without stop information, which every v1 group is. */
  stopSequences?: Record<string, SequenceStop[]>;
  /** WHY: absent means no refresh button and no polling. */
  refresh?: ServiceRefresh;
}

export interface RouteBadge {
  id: string;
  label: string;
  /** WHY: hex digits, no '#'. */
  color: string;
}

export interface ScheduleScreenConfig {
  services: BusService[];
  defaultServiceId?: string;
  serviceSelector: ServiceSelector;
  stops: BoardingStop[];
  routeBadges: RouteBadge[];
  features: Record<string, unknown>[];
}


interface BusGroupBase {
  id: string;
  label: string;
  visibility: BusGroupVisibility;
  card: BusGroupCard;
}

export interface RealtimeBusGroup extends BusGroupBase {
  screenType: 'realtime';
  screen: RealtimeScreenConfig;
}

export interface ScheduleBusGroup extends BusGroupBase {
  screenType: 'schedule';
  screen: ScheduleScreenConfig;
}

export type BusGroup = RealtimeBusGroup | ScheduleBusGroup;

/**
 * CONTRACT(skkuverse-server): skkuverse-server/docs/reference/bus-live-api.md
 * Every instant is epoch milliseconds, and an unknown enum value reads as the fallback that reference names.
 */

export type LiveOperation = 'running' | 'ended' | 'noData';

/** WHY: an unknown status reads as `unknown`, which shows the source's own text. */
export type ArrivalStatus = 'arriving' | 'enRoute' | 'waitingToDepart' | 'scheduled' | 'unknown';

/** WHY: a value this build does not know reads as `unknown`. */
export type CallBasis = 'provider' | 'estimate' | 'timetable' | 'unknown';

export interface LiveArrival {
  status: ArrivalStatus;
  expectedArrivalAtMs: number | null;
  stopsAway: number | null;
  /** WHY: false when the server does not say. */
  isLastRun: boolean;
  /** WHY: null when the source names no bus (a slot waiting to depart). */
  vehicleId: string | null;
  /** WHY: the upstream's own text, in Korean, shown as served. */
  providerText: string | null;
}

export interface LiveStation {
  stationIndex: number;
  operation: LiveOperation;
  arrivals: LiveArrival[];
}

/** WHY: not the timetable's `Crowding`; a different source and scale. The parser reads any other value as null. */
export type RealtimeCrowding = 'relaxed' | 'normal' | 'crowded';

/** WHY: an unknown position status reads as `inTransit`. */
export type VehicleStatus = 'inTransit' | 'atStop' | 'waitingToDepart';

/**
 * WHY: `positionAtMs` is when the source saw the bus, normally minutes old on a stop-event source; `checkedAtMs` is what ages the marker.
 */
export interface VehiclePosition {
  stationIndex: number;
  status: VehicleStatus;
  progress: number | null;
  sectionMeters: number | null;
  nextStationAtMs: number | null;
  positionAtMs: number;
  checkedAtMs: number;
}

/** WHY: `s` is the stop index plus the share toward the next stop (9.5 is halfway from 9 to 10); on a loop it may pass the last index. */
export interface TrajectoryKnot {
  atMs: number;
  s: number;
}

export interface LiveVehicle {
  id: string;
  plateNumber: string | null;
  crowding: RealtimeCrowding | null;
  /** WHY: null when the source cannot say or a server before the field. */
  isLowFloor: boolean | null;
  /** WHY: null for a bus an arrival names without a position, which has no marker. */
  position: VehiclePosition | null;
  /** WHY: knots ascend in time with a non-decreasing `s`; null when the bus is not moving. */
  trajectory: TrajectoryKnot[] | null;
}

export interface LiveGroup {
  groupId: string;
  /** WHY: null means nothing is cached (the poller stopped), which is not "no buses". */
  updatedAtMs: number | null;
  operation: LiveOperation;
  vehicles: LiveVehicle[];
  stations: LiveStation[];
  serverNowMs?: number;
}


export interface BusStop {
  id: string;
  name: I18nText;
  /** WHY: null while the server has no coordinates: draw no pin. */
  coords: LatLng | null;
  campus: Campus | null;
  routes: BusStopRoute[];
}

export type BusStopRoute =
  | {
      kind: 'live';
      groupId: string;
      label: I18nText;
      stationIndex: number;
      towards: I18nText | null;
      action: StopAction;
    }
  | {
      kind: 'timetable';
      groupId: string;
      label: I18nText;
      serviceId: string;
      routeType: string;
      action: StopAction;
    };

/** WHY: everything but `station` is null while the list does not hold the stop or the station has no page. */
export interface LineStation {
  station: RealtimeStation;
  stopId: string | null;
  name: I18nText | null;
  coords: LatLng | null;
  campus: Campus | null;
  towards: I18nText | null;
}

export type TimetableOperation = 'running' | 'suspended' | 'noData';

export interface TimetableRun {
  runDepartureAtMs: number;
  atMs: number | null;
  isEstimate: boolean;
  isLastRun: boolean;
}

interface StopRouteBase {
  groupId: string;
  label: string;
  /** WHY: `alight` at a drop-off-only stop shows no boarding wording. */
  action: StopAction;
}

export type StopRoute =
  | (StopRouteBase & {
      kind: 'live';
      stationIndex: number;
      towards: string | null;
      direction: { id: string; label: string } | null;
      operation: LiveOperation;
      updatedAtMs: number | null;
      vehicles: LiveVehicle[];
      arrivals: LiveArrival[];
    })
  | (StopRouteBase & {
      kind: 'timetable';
      serviceId: string;
      routeType: string;
      operation: TimetableOperation;
      runs: TimetableRun[];
    });

export interface StopArrivals {
  stop: {
    /** WHY: may differ from the id asked for (an aliased pole). */
    id: string;
    name: string;
    coords: LatLng | null;
  };
  routes: StopRoute[];
  serverNowMs?: number;
}


/** WHY: the parser reads any other value, `error` included, as `info`. */
export type ScheduleNoticeStyle = 'info' | 'warning' | 'ai';

export interface ScheduleNotice {
  style: ScheduleNoticeStyle;
  text: string;
  source: string;
}

/** WHY: the parser reads an unknown source as `unknown` and keeps the estimate, since the server may add sources. */
export type EtaSource = 'live' | 'frozen' | 'predicted' | 'unknown';

/** WHY: not served yet, so every run reads `unknown`; the parser reads a missing or unknown level as `unknown`. */
export type Crowding = 'unknown' | 'spacious' | 'crowded' | 'full';

export interface ScheduleEntry {
  index: number;
  time: string;
  routeType: string;
  busCount: number;
  notes?: string;
  /** WHY: `stopTimes[0]` is `time`; null where the time is not known. Absent on every v1 entry. */
  stopTimes?: (string | null)[];
  /** WHY: a commute run's estimated stops carry timetable times and no `eta`, so only `eta` says a time is a traffic estimate. */
  eta?: { source: EtaSource; updatedAt: string };
  crowding: Crowding;
}

export interface DaySchedule {
  date: string;
  /** WHY: 1 is Monday through 7 Sunday. */
  dayOfWeek: number;
  display: string;
  label?: string;
  notices: ScheduleNotice[];
  schedule: ScheduleEntry[];
}

export interface SmartSchedule {
  serviceId: string;
  status: string;
  from?: string;
  selectedDate?: string;
  days: DaySchedule[];
  resumeDate?: string;
  message?: string;
}

/**
 * CONTRACT(skkuverse-server): skkuverse-server/src/ui/transit/
 * Navigation goes by an item's `action` alone, never by its `kind`.
 */

export interface TransitIcon {
  type: string;
  color: string;
  text: string;
}

export interface TransitLine {
  code: string;
  name: string;
  /** WHY: six hex digits, no '#'; the row draws the marker's color instead. */
  color: string;
  marker: SubwayLineMarker;
}

export interface TransitItemBase {
  /** WHY: stable; the list key and the analytics id. */
  id: string;
  title: string;
  subtitle: string | null;
  action: { actionType: ActionType; actionValue: string };
}

export type TransitRowItem =
  | (TransitItemBase & { kind: 'bus'; groupId: string; icon: TransitIcon })
  | (TransitItemBase & { kind: 'subway'; stationId: string; lines: TransitLine[] })
  | (TransitItemBase & { kind: 'link'; icon: TransitIcon });

/** WHY: no `action`, a tap toggles it; `initialState` is how it first draws. */
export interface TransitGroup {
  kind: 'group';
  /** WHY: the fold's memory key. */
  id: string;
  title: string;
  subtitle: string | null;
  icon: TransitIcon;
  initialState: TransitGroupState;
  /** WHY: never empty, and never a group; a group left without rows is dropped. */
  items: TransitRowItem[];
}

export type TransitItem = TransitRowItem | TransitGroup;

export type TransitItemKind = TransitItem['kind'];

export interface TransitSection {
  type: 'item_list';
  id: string;
  /** WHY: null means no header over the rows. */
  title: string | null;
  /** WHY: null means both campuses; a tagged section shows only while its campus is selected under the shared map. */
  campus: Campus | null;
  /** WHY: never empty; a section left without items is dropped. */
  items: TransitItem[];
}

export interface TransitLayout {
  /** WHY: logged only; a breaking change comes as a new route. */
  version: number;
  sections: TransitSection[];
}
