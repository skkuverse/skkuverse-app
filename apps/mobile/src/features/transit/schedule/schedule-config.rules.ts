import type { BoardingStop, BusService, RouteBadge, ScheduleEntry, SequenceStop } from '../transit.types';

export type ServiceSource = 'tap' | 'param' | 'remembered' | 'default' | 'first';

export interface ServiceCandidates {
  tapped?: string | null;
  param?: string;
  remembered?: string;
  defaultId?: string;
}

/** WHY: an id the server no longer lists falls through, so a stale remembered value never empties the screen. */
export function resolveScheduleService(
  services: readonly BusService[],
  candidates: ServiceCandidates,
): { service: BusService; source: ServiceSource } | undefined {
  const ordered: [string | null | undefined, ServiceSource][] = [
    [candidates.tapped, 'tap'],
    [candidates.param, 'param'],
    [candidates.remembered, 'remembered'],
    [candidates.defaultId, 'default'],
  ];
  for (const [id, source] of ordered) {
    const service = id ? services.find((s) => s.serviceId === id) : undefined;
    if (service) return { service, source };
  }
  const first = services[0];
  return first ? { service: first, source: 'first' } : undefined;
}

export interface RunStop {
  stop: SequenceStop;
  time: string | null;
  note: string | null;
}

export function runStops(
  entry: ScheduleEntry,
  sequences: BusService['stopSequences'],
): RunStop[] | null {
  const sequence = sequences?.[entry.routeType];
  const times = entry.stopTimes;
  if (!sequence || !times || sequence.length !== times.length) return null;
  return sequence.map((stop, k) => ({ stop, time: times[k], note: stop.note ?? null }));
}

/** WHY: only the last scheduled boarding stop decides; an estimate never does, since a rider further on still catches the bus. */
export function decidingTime(entry: ScheduleEntry, sequences: BusService['stopSequences']): string {
  const stops = runStops(entry, sequences);
  if (!stops) return entry.time;
  let last = entry.time;
  for (const { stop, time } of stops) {
    if (stop.action === 'board' && stop.timing === 'scheduled' && time) last = time;
  }
  return last;
}

export function routeTypesForDay(
  sequences: BusService['stopSequences'],
  routeBadges: readonly RouteBadge[],
  entries: readonly ScheduleEntry[] | undefined,
): string[] {
  const badgeOrder = routeBadges.map((b) => b.id);
  const rank = (routeType: string) => {
    const i = badgeOrder.indexOf(routeType);
    return i < 0 ? Infinity : i;
  };
  const all = Object.keys(sequences ?? {}).sort((a, b) => rank(a) - rank(b));
  const running = all.filter((rt) => entries?.some((e) => e.routeType === rt));
  return running.length > 0 ? running : all;
}

export interface DayRoute {
  routeTypes: string[];
  sequence: SequenceStop[];
  range: string | null;
}

export function routesForDay(
  sequences: BusService['stopSequences'],
  routeBadges: readonly RouteBadge[],
  entries: readonly ScheduleEntry[] | undefined,
): { routes: DayRoute[]; labelled: boolean } {
  const all: Omit<DayRoute, 'range'>[] = [];
  for (const routeType of routeTypesForDay(sequences, routeBadges, undefined)) {
    const sequence = sequences?.[routeType];
    if (!sequence) continue;
    const same = all.find(
      (route) => route.sequence.length === sequence.length && route.sequence.every((s, k) => sameStop(s, sequence[k])),
    );
    if (same) same.routeTypes.push(routeType);
    else all.push({ routeTypes: [routeType], sequence });
  }
  const shown = new Set(routeTypesForDay(sequences, routeBadges, entries));
  const routes = all
    .filter((route) => route.routeTypes.some((rt) => shown.has(rt)))
    .map((route) => ({ ...route, range: timeRange(entries, route.routeTypes) }));
  return { routes, labelled: all.length > 1 };
}

/** WHY: a note or a timing does not make a different stop. */
function sameStop(a: SequenceStop, b: SequenceStop): boolean {
  if (a.action !== b.action) return false;
  if (a.stopId || b.stopId) return a.stopId === b.stopId;
  return a.label === b.label && a.detail === b.detail;
}

function timeRange(entries: readonly ScheduleEntry[] | undefined, routeTypes: readonly string[]): string | null {
  const times = (entries ?? []).filter((e) => routeTypes.includes(e.routeType)).map((e) => e.time);
  if (times.length === 0) return null;
  const first = times[0];
  const last = times[times.length - 1];
  return first === last ? first : `${first}–${last}`;
}

export function splitStops(line: string): string[] {
  return line
    .split('→')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export interface RouteRowSpec {
  key: string;
  name: string;
  role: string;
  action: SequenceStop['action'];
  detail?: string;
  stop?: BoardingStop;
}

export function toRouteRows(
  sequence: SequenceStop[],
  catalog: ReadonlyMap<string, BoardingStop>,
  roleOf: (action: SequenceStop['action']) => string,
): RouteRowSpec[] {
  return sequence.flatMap((seqStop, i): RouteRowSpec[] => {
    const role = roleOf(seqStop.action);
    const stop = seqStop.stopId ? catalog.get(seqStop.stopId) : undefined;
    const points = seqStop.action === 'alight' && seqStop.detail ? splitStops(seqStop.detail) : [];
    if (points.length >= 2) {
      return points.map((name, k) => ({
        key: `${i}-${k}`,
        name,
        role,
        action: seqStop.action,
        stop: k === 0 ? stop : undefined,
      }));
    }
    return [
      { key: `${i}-${seqStop.label}`, name: seqStop.label, role, action: seqStop.action, detail: seqStop.detail, stop },
    ];
  });
}
