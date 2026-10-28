import {
  kstMinutesOfDay,
  type TranslationKey,
} from '@skkuverse/shared';
import { decidingTime } from './schedule-config.rules';
import type { TimetableLayout } from './schedule.types';
import type { BusService, ScheduleEntry, RouteBadge, SmartSchedule } from '../transit.types';

type Sequences = BusService['stopSequences'];

function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** WHY: `now` is read on the KST clock, so a phone in another zone agrees with Seoul. */
export function getNextBus(
  entries: ScheduleEntry[],
  isToday: boolean,
  sequences: Sequences | undefined,
  now: number,
): ScheduleEntry | undefined {
  if (entries.length === 0) return undefined;
  if (!isToday) return entries[0];

  const nowMinutes = kstMinutesOfDay(now);
  return entries.find((entry) => minutesOf(decidingTime(entry, sequences)) > nowMinutes);
}

export function isPastBus(
  entry: ScheduleEntry,
  isToday: boolean,
  sequences: Sequences | undefined,
  now: number,
): boolean {
  return isPastTime(decidingTime(entry, sequences), isToday, now);
}

export function isPastTime(time: string, isToday: boolean, now: number): boolean {
  if (!isToday) return false;
  return minutesOf(time) <= kstMinutesOfDay(now);
}

export type StopDotTone = 'otherDay' | 'past' | 'next' | 'upcoming';

export interface DecideStopDotToneInputs {
  layout: TimetableLayout;
  isToday: boolean;
  isNext: boolean;
  past: boolean;
  hollow: boolean;
}

export function decideStopDotTone({ layout, isToday, isNext, past, hollow }: DecideStopDotToneInputs): StopDotTone {
  if (layout === 'sectioned') {
    if (past) return 'past';
    return isNext && !hollow ? 'next' : 'upcoming';
  }
  if (!isToday) return 'otherDay';
  if (past) return 'past';
  return isNext ? 'next' : 'upcoming';
}

export function hasMultipleRouteTypes(entries: ScheduleEntry[]): boolean {
  if (entries.length === 0) return false;
  const types = new Set(entries.map((e) => e.routeType));
  return types.size > 1;
}

export function getSelectedDayIndex(schedule: SmartSchedule): number {
  if (!schedule.selectedDate || schedule.days.length === 0) return 0;
  const idx = schedule.days.findIndex((d) => d.date === schedule.selectedDate);
  return idx >= 0 ? idx : 0;
}

export function getRouteBadge(
  badges: RouteBadge[],
  routeType: string,
): RouteBadge {
  return (
    badges.find((b) => b.id === routeType) ?? {
      id: routeType,
      label: routeType,
      color: '9E9E9E',
    }
  );
}

export function formatDuration(
  ms: number,
  tpl: (key: TranslationKey, ...args: (string | number)[]) => string,
): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return tpl('eta.minutes', minutes);
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (remaining === 0) return tpl('eta.hours', hours);
  return tpl('eta.hoursMinutes', hours, remaining);
}
