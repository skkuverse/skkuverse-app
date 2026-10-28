// CONTRACT(skkuverse-server): skkuverse-server/docs/decisions/0022-journey-and-call-spec.md
// WHY: the server plans every option per request, so these types carry its answer and the app renders the order sent.

import type { ActionType } from '@skkuverse/shared';

export interface PlaceAction {
  actionType: ActionType;
  actionValue: string;
}

export interface RideExpansion {
  isExpanded: (index: number) => boolean;
  toggle: (index: number) => void;
}

export interface RoutePlace {
  name: string;
  action?: PlaceAction;
}

export interface BoardCall {
  // WHY: a headway guess has neither `runId` nor `vehicleId`; a predicted bus has a vehicle and is not one.
  isHeadwayGuess: boolean;
  isLastRun: boolean;
}

export interface UpcomingCall extends BoardCall {
  at: number;
}

interface LegBase {
  from: RoutePlace;
  to: RoutePlace;
  startAt: number;
  endAt: number;
  durationSec: number;
  label: string;
  // WHY: open key; an unknown one draws the generic mark.
  icon: string;
  color?: string;
}

// WHY: `other` is a leg kind this build does not know, drawn from the base fields alone.
export type RouteLeg =
  | (LegBase & { kind: 'walk' })
  | (LegBase & { kind: 'transfer' })
  | (LegBase & {
      kind: 'ride';
      board: BoardCall;
      upcoming: UpcomingCall[];
      stops: RoutePlace[] | null;
      isRail: boolean;
    })
  | (LegBase & { kind: 'other' });

// WHY: an unknown reason on the wire reads as `ended`.
export type NotRunningReason = 'ended' | 'notStarted' | 'unavailable';

export interface RouteWarning {
  code: string;
  // WHY: `code` is an open set; `message` is product copy, shown as given.
  message: string;
}

interface OptionBase {
  id: string;
  name: string;
  warnings: RouteWarning[];
}

export type RouteOption =
  | (OptionBase & {
      status: 'running';
      leaveAt: number;
      arriveAt: number;
      // WHY: a running option always has at least one leg.
      legs: [RouteLeg, ...RouteLeg[]];
    })
  | (OptionBase & {
      status: 'notRunning';
      reason: NotRunningReason;
      nextServiceAt?: number;
    });

export type RunningOption = Extract<RouteOption, { status: 'running' }>;
export type NotRunningOption = Extract<RouteOption, { status: 'notRunning' }>;

export interface CampusRoute {
  id: string;
  name: string;
  options: RouteOption[];
}

export interface CampusRoutesAnswer {
  routes: CampusRoute[];
  serverNowMs?: number;
  receivedAtMs: number;
}

export interface BarSegmentView {
  minutes: number;
  color?: string;
}

export interface RunView {
  text: string;
  isLastRun: boolean;
}

export type RideTimingView =
  | { kind: 'upcoming'; runs: RunView[] }
  | { kind: 'planned'; board: RunView };

export interface RideView {
  label: string;
  emoji: string;
  color?: string;
  board: RoutePlace;
  alight: RoutePlace;
  timing: RideTimingView;
  stopsSummary: string | null;
  stops: RoutePlace[];
}

export type TimelineItemView =
  | { kind: 'start'; place: RoutePlace }
  | {
      kind: 'step';
      emoji: string;
      text: string;
    }
  | ({ kind: 'ride' } & RideView)
  | { kind: 'end'; place: RoutePlace };

export type OptionView =
  | {
      status: 'running';
      name: string;
      minutes: number;
      leave: string;
      warnings: string[];
      bar: BarSegmentView[];
      timeline: TimelineItemView[];
    }
  | {
      status: 'notRunning';
      name: string;
      statusLine: string;
      warnings: string[];
    };
