import type {
  MealsCafeteria,
  MealsCode,
  MealsCorner,
  MealsDaily,
  MealsName,
  MealsScreenCafeteria,
  MealsScreenCorner,
  MealsScreenTab,
} from './meals.types';

import { MEALS_OVER_AT_HOUR } from './meals.constants';

// WHY: from the epoch, never Date.getHours(), so a phone in another zone asks for the campus's day.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function toKstDate(now: number): string {
  return new Date(now + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export function toShiftedDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function toWeekDates(date: string, weeks = 0): string[] {
  const monday = toShiftedDate(date, -((toWeekday(date) + 6) % 7) + weeks * 7);
  return Array.from({ length: 7 }, (_, i) => toShiftedDate(monday, i));
}

export function toWeekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function decideMealForHour(now: number): MealsCode {
  const hour = new Date(now + KST_OFFSET_MS).getUTCHours();
  if (hour < 10) return 'B';
  if (hour < 15) return 'L';
  return 'D';
}

export function toWon(amount: number): string {
  return String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function toName(name: MealsName, lang: 'ko' | 'en'): string {
  return lang === 'ko' ? name.ko : name.en;
}

function toCorner(corner: MealsCorner, index: number): MealsScreenCorner | null {
  const title = corner.floor ? `${corner.name} · ${corner.floor}` : corner.name;
  const key = `${index}-${corner.name}`;
  if (!corner.needsReview && corner.items.length > 0) return { kind: 'items', key, title, items: corner.items };
  // WHY: a corner the crawler could not parse shows the school's text; one with neither is dropped.
  return corner.rawText ? { kind: 'raw', key, title, text: corner.rawText } : null;
}

/**
 * CONTRACT(skkuverse-server): skkuverse-server/src/meals/menus/ keeps one corner per school
 * cell, for its own likes and raw text, so grouping same-titled corners is the reader's job.
 */
export function toMergedCorners(corners: MealsScreenCorner[]): MealsScreenCorner[] {
  const merged: MealsScreenCorner[] = [];
  for (const corner of corners) {
    const last = merged.at(-1);
    if (last?.kind === 'items' && corner.kind === 'items' && last.title === corner.title) {
      merged[merged.length - 1] = { ...last, items: [...last.items, ...corner.items] };
    } else {
      merged.push(corner);
    }
  }
  return merged;
}

function toCafeteria(cafeteria: MealsCafeteria, lang: 'ko' | 'en'): MealsScreenCafeteria {
  const subtitle = [cafeteria.building && toName(cafeteria.building.name, lang), cafeteria.floor && toName(cafeteria.floor, lang)]
    .filter(Boolean)
    .join(' · ');
  const meals = cafeteria.meals.map(({ code, corners }) => {
    const screenCorners = (fixed: boolean) =>
      toMergedCorners(
        corners.flatMap((corner, i) => {
          const screen = corner.isFixedMenu === fixed ? toCorner(corner, i) : null;
          return screen ? [screen] : [];
        }),
      );
    return { code, daily: screenCorners(false), fixed: screenCorners(true) };
  });
  return {
    id: cafeteria.id,
    title: toName(cafeteria.name, lang),
    subtitle,
    meals: meals.filter((meal) => meal.daily.length + meal.fixed.length > 0),
  };
}

export function toMealsScreenCafeterias(daily: MealsDaily, lang: 'ko' | 'en'): MealsScreenCafeteria[] {
  return daily.cafeterias.map((cafeteria) => toCafeteria(cafeteria, lang)).filter((cafeteria) => cafeteria.meals.length > 0);
}

function isMealOver(code: MealsCode, now: number): boolean {
  const overAt = code === 'B' || code === 'L' || code === 'D' ? MEALS_OVER_AT_HOUR[code] : undefined;
  return overAt !== undefined && new Date(now + KST_OFFSET_MS).getUTCHours() >= overAt;
}

export function toMealsScreenTabs(cafeteria: MealsScreenCafeteria, isToday: boolean, now: number): MealsScreenTab[] {
  return cafeteria.meals.map(({ code }) => (isToday && isMealOver(code, now) ? { code, closed: 'over' } : { code }));
}
