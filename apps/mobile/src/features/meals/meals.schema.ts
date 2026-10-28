// CONTRACT(skkuverse-server): skkuverse-server/src/meals/menus/ serves GET /meals and publishes its fixtures as meals-menus.dailyMeals.
import { z } from 'zod';
import {
  CAMPUSES,
  finiteNumber,
  openEnum,
  openUnionArray,
  opt,
  optionalText,
  parsedBy,
  text,
  tolerantArray,
} from '@skkuverse/shared';
import type { MealsCafeteria, MealsCode, MealsCorner, MealsDaily, MealsMenuItem, MealsName } from './meals.types';

const nameSchema = z
  .object({ ko: text, en: optionalText })
  .transform(({ ko, en }) => ({ ko, en: en ?? ko }) satisfies MealsName);

const itemSchema = z
  .object({
    name: text,
    priceKrw: opt(finiteNumber).catch(undefined),
    kind: openEnum(['single', 'set'] as const, 'single'),
    dishes: tolerantArray(text, 'meals.dishes').catch([]),
    quantity: optionalText,
    options: tolerantArray(z.object({ name: text, extraKrw: finiteNumber }), 'meals.options').catch([]),
    tags: tolerantArray(text, 'meals.tags').catch([]),
  })
  .transform((item) => item satisfies MealsMenuItem);

const cornerSchema = z
  .object({
    name: text,
    floor: optionalText,
    isFixedMenu: z.boolean().catch(false),
    items: tolerantArray(itemSchema, 'meals.items').catch([]),
    needsReview: z.boolean().catch(false),
    rawText: z.string().catch(''),
  })
  .transform((corner) => corner satisfies MealsCorner);

function mealSchema<const C extends MealsCode>(code: C) {
  return z.object({ code: z.literal(code), corners: tolerantArray(cornerSchema, 'meals.corners') });
}

const cafeteriaSchema = z
  .object({
    id: text,
    name: nameSchema,
    building: opt(z.object({ skkuId: finiteNumber, name: nameSchema })).catch(undefined),
    floor: opt(nameSchema).catch(undefined),
    // WHY: a meal code this build does not know is skipped, as a new kind would be.
    meals: openUnionArray(
      'code',
      { B: mealSchema('B'), L: mealSchema('L'), D: mealSchema('D'), S: mealSchema('S'), R: mealSchema('R') },
      'meals.meals',
    ),
  })
  .transform((cafeteria) => cafeteria satisfies MealsCafeteria);

export const mealsDailySchema = z.object({
  date: text,
  // WHY: a response for a campus this build does not know cannot be shown, so it fails whole.
  campus: parsedBy((value) => CAMPUSES.find((campus) => campus === value) ?? null),
  cafeterias: tolerantArray(cafeteriaSchema, 'meals.cafeterias'),
}) satisfies z.ZodType<MealsDaily>;
