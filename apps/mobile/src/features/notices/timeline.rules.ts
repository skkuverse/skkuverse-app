import { kstDate } from '@skkuverse/shared';
import {
  formatHourMinute,
  parseLocalDate,
  startOfLocalDay,
  toEffectiveDateTime,
} from './notice-date.rules';
import type { NoticePeriod } from './notices.types';

/**
 * WHY: dates leave the attribute table and become states on a time axis; a date and an attribute
 * at the same weight in one table hid where to look.
 */

export type TimelineStatus = 'past' | 'current' | 'future';

export interface TimelineEntry {
  label: string | null;
  range: string;
  status: TimelineStatus;
  /**
   * WHY: a separate axis from `current`: an unstarted step can be the nearest deadline, and the
   * hero's D-day and this row share one color so they read as one fact.
   */
  isHighlighted: boolean;
}

export interface NoticeTimeline {
  entries: TimelineEntry[];
}

/** WHY: the year is dropped only within the current KST year; always dropping it lies, always keeping it repeats. */
function formatDatePart(date: string, currentYear: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const md = `${m}.${d}`;
  return y === currentYear ? md : `${String(y).slice(2)}.${md}`;
}

function withTime(datePart: string, time: string | null): string {
  return time ? `${datePart} ${formatHourMinute(time)}` : datePart;
}

export function formatPeriodRange(
  period: NoticePeriod,
  currentYear: number,
): string | null {
  const { startDate, startTime, endDate, endTime } = period;
  if (!startDate && !endDate) return null;

  if (startDate && endDate) {
    // WHY: "8.7 ~ 8.7" is a point in time, not a range.
    if (startDate === endDate) {
      const day = formatDatePart(startDate, currentYear);
      if (startTime && endTime) {
        return `${day} ${formatHourMinute(startTime)} ~ ${formatHourMinute(endTime)}`;
      }
      return withTime(day, startTime);
    }
    return `${withTime(formatDatePart(startDate, currentYear), startTime)} ~ ${withTime(
      formatDatePart(endDate, currentYear),
      endTime,
    )}`;
  }

  // WHY: the tilde is the app's range notation; no space on the open side reads as continuing.
  if (endDate) return `~${withTime(formatDatePart(endDate, currentYear), endTime)}`;
  return `${withTime(formatDatePart(startDate!, currentYear), startTime)}~`;
}

function resolveStatus(period: NoticePeriod, now: Date): TimelineStatus {
  const todayStart = startOfLocalDay(now);
  const { startDate, endDate, endTime } = period;

  if (endDate) {
    const endDT = toEffectiveDateTime(endDate, endTime);
    if (endDT.getTime() < now.getTime()) return 'past';
    // WHY: no start date is never `current`, which claims "you can do this now"; judging it
    // current marked a later step in progress while skipping an application not yet open.
    if (!startDate) return 'future';
    return startOfLocalDay(parseLocalDate(startDate)) <= todayStart
      ? 'current'
      : 'future';
  }

  if (startDate) {
    return startOfLocalDay(parseLocalDate(startDate)) <= todayStart
      ? 'current'
      : 'future';
  }

  return 'future';
}

/**
 * WHY: chosen by end date, since missing a deadline is what costs the reader; an open-ended period
 * has no deadline to miss.
 */
function findNearestDeadlineIndex(periods: NoticePeriod[], now: Date): number {
  let bestIndex = -1;
  let bestTime = Infinity;

  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    if (!p.endDate) continue;
    const endMs = toEffectiveDateTime(p.endDate, p.endTime).getTime();
    if (endMs < now.getTime()) continue;
    if (endMs < bestTime) {
      bestTime = endMs;
      bestIndex = i;
    }
  }

  return bestIndex;
}

export function buildNoticeTimeline(
  periods: NoticePeriod[],
  now: Date,
): NoticeTimeline {
  const currentYear = Number(kstDate(now.getTime()).slice(0, 4));

  const nearestIndex = findNearestDeadlineIndex(periods, now);

  // WHY: dateless periods drop out and the rest re-sort, so each row keeps its original index.
  const rows: { period: NoticePeriod; index: number; range: string; startsAt: number }[] = [];
  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    const range = formatPeriodRange(p, currentYear);
    if (!range) continue;
    rows.push({ period: p, index: i, range, startsAt: firstInstant(p) });
  }

  // WHY: periods arrive in body order, which is not time order; a tie keeps body order, which is a
  // multi-step procedure's own order, so the sort is total without relying on stability.
  rows.sort((a, b) => a.startsAt - b.startsAt || a.index - b.index);

  const entries = rows.map(
    ({ period, index, range }): TimelineEntry => ({
      label: period.label,
      range,
      status: resolveStatus(period, now),
      isHighlighted: index === nearestIndex,
    }),
  );

  return { entries };
}

/** WHY: a period with no start appears at its deadline, and a date with no time counts as midnight. */
function firstInstant({ startDate, startTime, endDate, endTime }: NoticePeriod): number {
  const [date, time] = startDate ? [startDate, startTime] : [endDate!, endTime];
  return (time ? toEffectiveDateTime(date, time) : parseLocalDate(date)).getTime();
}
