import type { TranslationKey } from '@skkuverse/shared';
import type { DaySchedule } from '../transit.types';

export interface WeekGroup {
  label: string;
  days: DaySchedule[];
  startIndex: number;
}

const ORDINAL_KEYS: Record<number, TranslationKey> = {
  1: 'week.ordinal1',
  2: 'week.ordinal2',
  3: 'week.ordinal3',
  4: 'week.ordinal4',
  5: 'week.ordinal5',
};

function getWeekLabel(
  dateStr: string,
  t: (key: TranslationKey) => string,
  tpl: (key: TranslationKey, ...args: (string | number)[]) => string,
): string {
  const [, monthStr, dayStr] = dateStr.split('-');
  const month = Number(monthStr);
  const dayOfMonth = Number(dayStr);
  const weekNum = Math.ceil(dayOfMonth / 7);
  const ordinal = ORDINAL_KEYS[weekNum] ? t(ORDINAL_KEYS[weekNum]) : `${weekNum}`;
  return tpl('week.weekLabel', month, ordinal);
}

export function groupDaysByWeek(
  days: DaySchedule[],
  t: (key: TranslationKey) => string,
  tpl: (key: TranslationKey, ...args: (string | number)[]) => string,
): WeekGroup[] {
  if (days.length === 0) return [];

  const groups: WeekGroup[] = [];
  let currentDays: DaySchedule[] = [];
  let startIndex = 0;

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    if (currentDays.length > 0 && day.dayOfWeek <= currentDays[currentDays.length - 1].dayOfWeek) {
      groups.push({
        label: getWeekLabel(currentDays[0].date, t, tpl),
        days: currentDays,
        startIndex,
      });
      currentDays = [];
      startIndex = i;
    }
    currentDays.push(day);
  }

  if (currentDays.length > 0) {
    groups.push({
      label: getWeekLabel(currentDays[0].date, t, tpl),
      days: currentDays,
      startIndex,
    });
  }

  return groups;
}

export function findWeekAndDayIndex(
  weeks: WeekGroup[],
  flatIndex: number,
): { weekIndex: number; dayInWeekIndex: number } {
  for (let w = 0; w < weeks.length; w++) {
    const week = weeks[w];
    if (flatIndex >= week.startIndex && flatIndex < week.startIndex + week.days.length) {
      return { weekIndex: w, dayInWeekIndex: flatIndex - week.startIndex };
    }
  }
  return { weekIndex: 0, dayInWeekIndex: 0 };
}
