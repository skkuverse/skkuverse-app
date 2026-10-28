import {
  KST_OFFSET_MS,
  toMinutesOfDay,
} from '@skkuverse/shared';
import type { RunStop } from './schedule-config.rules';
import type { BoardingStop, ScheduleEntry } from '../transit.types';

export type RunAttachmentKind = 'transfer';

export type RunAttachmentAnchor = { level: 'run' } | { level: 'stop'; stopId: string };

export interface RunAttachmentWindow {
  from: 'departure' | 'stopTime';
  startMin: number;
  endMin: number;
}

export interface RunAttachment {
  id: string;
  kind: RunAttachmentKind;
  anchor: RunAttachmentAnchor;
  window: RunAttachmentWindow;
  priority: number;
  payload: { stationId: string; title: string };
}

export type PlacedAttachment = RunAttachment & { instanceId: string };

export interface PlacedAttachments {
  anchor: RunAttachmentAnchor;
  items: PlacedAttachment[];
}

export interface RunRef {
  serviceId: string;
  date: string;
}

export interface AttachmentSources extends RunRef {
  catalog: readonly BoardingStop[];
}

export const MAX_PER_ANCHOR = 2;

export const TRANSFER_PRIORITY = 50;
const TRANSFER_WINDOW: RunAttachmentWindow = { from: 'stopTime', startMin: -20, endMin: 10 };

export function attachmentsFor(
  entry: ScheduleEntry,
  stops: readonly RunStop[] | null,
  now: number,
  sources: AttachmentSources,
): PlacedAttachments[] {
  return placeAttachments(toTransferAttachments(stops, sources.catalog), entry, stops, now, sources);
}

function toTransferAttachments(stops: readonly RunStop[] | null, catalog: readonly BoardingStop[]): RunAttachment[] {
  if (!stops) return [];
  const stations = new Map(catalog.flatMap((s) => (s.subwayStation ? [[s.id, s.subwayStation] as const] : [])));
  return stops.flatMap(({ stop }): RunAttachment[] => {
    const station = stop.action === 'alight' && stop.stopId ? stations.get(stop.stopId) : undefined;
    if (!station || !stop.stopId) return [];
    return [
      {
        id: `transfer:${station.id}`,
        kind: 'transfer',
        anchor: { level: 'stop', stopId: stop.stopId },
        window: TRANSFER_WINDOW,
        priority: TRANSFER_PRIORITY,
        payload: { stationId: station.id, title: station.title },
      },
    ];
  });
}

/**
 * WHY: a window is two instants in Asia/Seoul, never the device's zone. `departure` is the scheduled `entry.time`,
 * never an estimate; `stopTime` is the anchor stop's served time (the estimate where there is one), a day later
 * when it is earlier than the departure.
 */
export function placeAttachments(
  candidates: readonly RunAttachment[],
  entry: ScheduleEntry,
  stops: readonly RunStop[] | null,
  now: number,
  run: RunRef,
): PlacedAttachments[] {
  const runKey = toRunKey(run.serviceId, run.date, entry);
  const departAt = toKstInstant(run.date, entry.time);
  if (departAt === null) return [];
  const anchorOrder = (anchor: RunAttachmentAnchor) =>
    anchor.level === 'run' ? -1 : (stops?.findIndex(({ stop }) => stop.stopId === anchor.stopId) ?? -1);
  const referenceAt = ({ anchor, window }: RunAttachment): number | null => {
    if (window.from === 'departure') return departAt;
    if (anchor.level === 'run') return null;
    const time = stops?.find(({ stop }) => stop.stopId === anchor.stopId)?.time ?? null;
    const at = time === null ? null : toKstInstant(run.date, time);
    if (at === null) return null;
    return time! < entry.time ? at + DAY_MS : at;
  };

  const showing = candidates
    .filter((a) => a.anchor.level === 'run' || anchorOrder(a.anchor) >= 0)
    .filter((a) => {
      const at = referenceAt(a);
      return at !== null && now >= at + a.window.startMin * MINUTE_MS && now <= at + a.window.endMin * MINUTE_MS;
    })
    .sort((a, b) => b.priority - a.priority);

  const instances = new Set<string>();
  const groups = new Map<string, PlacedAttachments & { order: number }>();
  for (const attachment of showing) {
    const instanceId = toAttachmentInstanceId(attachment.id, runKey);
    if (instances.has(instanceId)) continue;
    instances.add(instanceId);
    const key = attachment.anchor.level === 'run' ? 'run' : `stop:${attachment.anchor.stopId}`;
    const group = groups.get(key) ?? { anchor: attachment.anchor, items: [], order: anchorOrder(attachment.anchor) };
    if (group.items.length < MAX_PER_ANCHOR) group.items.push({ ...attachment, instanceId });
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.order - b.order).map(({ anchor, items }) => ({ anchor, items }));
}

export function toLineAttachments(
  groups: readonly PlacedAttachments[],
  stops: readonly RunStop[] | null,
): PlacedAttachments[][] {
  const lineCount = stops?.length ?? 1;
  const lines = Array.from({ length: lineCount }, (): PlacedAttachments[] => []);
  for (const group of groups) {
    const { anchor } = group;
    const line =
      anchor.level === 'run'
        ? lineCount - 1
        : (stops?.findIndex(({ stop }) => stop.stopId === anchor.stopId) ?? -1);
    if (line >= 0) lines[line].push(group);
  }
  return lines;
}

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

function toKstInstant(date: string, hhmm: string): number | null {
  const minutes = toMinutesOfDay(hhmm);
  const midnightUtc = Date.parse(`${date}T00:00:00Z`);
  if (minutes === null || !Number.isFinite(midnightUtc)) return null;
  return midnightUtc - KST_OFFSET_MS + minutes * MINUTE_MS;
}

/** CONTRACT(skkuverse-server): `runKey` in skkuverse-server/src/bus/eta/smart/bus-eta-smart.rules.ts; routeType keeps same-time runs apart. */
export function toRunKey(serviceId: string, date: string, entry: Pick<ScheduleEntry, 'routeType' | 'time'>): string {
  return `${serviceId}|${entry.routeType}|${date}|${entry.time}`;
}

export function toAttachmentInstanceId(attachmentId: string, runKey: string): string {
  return `${attachmentId}@${runKey}`;
}

export function isNewAttachmentView(seen: Set<string>, key: string): boolean {
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}
