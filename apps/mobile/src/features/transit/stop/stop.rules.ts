import { kstMinutesOfDay } from '@skkuverse/shared';
import { arrivalLines, type ArrivalLine } from '../arrival.rules';
import type { RealtimeStation, StopArrivals, TimetableOperation, TimetableRun } from '../transit.types';

export type StopSheetRow =
  | {
      kind: 'live';
      key: string;
      label: string;
      direction: string | null;
      towards: string | null;
      isAlightOnly: boolean;
      arrival: ArrivalLine | undefined;
    }
  | {
      kind: 'timetable';
      key: string;
      label: string;
      isAlightOnly: boolean;
      operation: TimetableOperation;
      next: TimetableRun | null;
    };

export function toStopSheetRows(page: StopArrivals, nowMs: number): StopSheetRow[] {
  return page.routes.map((route): StopSheetRow => {
    const isAlightOnly = route.action === 'alight';
    if (route.kind === 'live') {
      // WHY: the line is the one station here, so a station-level `ended` or
      // `noData` reads as the row's text rather than emptying the whole page.
      const lines = arrivalLines(
        {
          operation: 'running',
          stations: [{ stationIndex: route.stationIndex, operation: route.operation, arrivals: route.arrivals }],
        },
        nowMs,
      );
      return {
        kind: 'live',
        key: route.groupId,
        label: route.label,
        direction: route.direction?.label ?? null,
        towards: route.towards,
        isAlightOnly,
        arrival: lines.get(route.stationIndex),
      };
    }
    return {
      kind: 'timetable',
      key: `${route.groupId}:${route.serviceId}:${route.routeType}`,
      label: route.label,
      isAlightOnly,
      operation: route.operation,
      next: route.runs[0] ?? null,
    };
  });
}

// WHY: positions without a page (no `stopId`, such as the HSSC rotary passes) are skipped.
export function toLineNeighbours(
  stations: readonly RealtimeStation[],
  stationIndex: number,
): { prev: RealtimeStation | null; next: RealtimeStation | null } {
  const paged = stations.filter((s) => s.stopId);
  const before = paged.filter((s) => s.index < stationIndex);
  return {
    prev: before[before.length - 1] ?? null,
    next: paged.find((s) => s.index > stationIndex) ?? null,
  };
}

export function lineEntryOf(page: StopArrivals, groupId: string): { towards: string | null } | null {
  const entry = page.routes.find((r) => r.kind === 'live' && r.groupId === groupId);
  return entry?.kind === 'live' ? { towards: entry.towards } : null;
}

export function kstClockOf(ms: number): string {
  const minutes = kstMinutesOfDay(ms);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
