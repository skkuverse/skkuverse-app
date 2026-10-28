import type { Campus } from '@skkuverse/shared';
import type { MEALS_CODES } from './meals.constants';

export type MealsCode = (typeof MEALS_CODES)[number];

export interface MealsName {
  ko: string;
  en: string;
}

export interface MealsMenuItem {
  name: string;
  priceKrw?: number;
  kind: 'single' | 'set';
  dishes: string[];
  quantity?: string;
  options: { name: string; extraKrw: number }[];
  tags: string[];
}

export interface MealsCorner {
  name: string;
  floor?: string;
  isFixedMenu: boolean;
  items: MealsMenuItem[];
  needsReview: boolean;
  rawText: string;
}

export interface MealsMeal {
  code: MealsCode;
  corners: MealsCorner[];
}

export interface MealsCafeteria {
  id: string;
  name: MealsName;
  building?: { skkuId: number; name: MealsName };
  floor?: MealsName;
  meals: MealsMeal[];
}

export interface MealsDaily {
  date: string;
  campus: Campus;
  cafeterias: MealsCafeteria[];
}

export type MealsScreenCorner =
  | { kind: 'items'; key: string; title: string; items: MealsMenuItem[] }
  | { kind: 'raw'; key: string; title: string; text: string };

export interface MealsScreenMeal {
  code: MealsCode;
  daily: MealsScreenCorner[];
  fixed: MealsScreenCorner[];
}

export interface MealsScreenTab {
  code: MealsCode;
  closed?: 'over';
}

export interface MealsScreenCafeteria {
  id: string;
  title: string;
  subtitle: string;
  meals: MealsScreenMeal[];
}

export interface MealsScreenDay {
  date: string;
  day: number;
  weekday: number;
  isToday: boolean;
}
