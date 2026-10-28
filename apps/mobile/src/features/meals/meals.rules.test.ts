import { describe, expect, it } from 'vitest';
import { decideMealForHour, toKstDate, toMealsScreenCafeterias, toMealsScreenTabs, toMergedCorners, toShiftedDate, toWeekDates, toWeekday, toWon } from './meals.rules';
import { mealsDailySchema } from './meals.schema';
import type { MealsScreenCorner } from './meals.types';
import nsc from './__fixtures__/meals-daily.nsc-2026-10-14.json';

const NSC = mealsDailySchema.parse(nsc.data);
const at = (kst: string) => Date.parse(`${kst}+09:00`);

describe('KST dates', () => {
  it.each([
    ['2026-10-16T14:59:59Z', '2026-10-16'],
    ['2026-10-16T15:00:00Z', '2026-10-17'],
  ])('%s is %s in KST', (utc, kst) => {
    // Act & Assert
    expect(toKstDate(Date.parse(utc))).toBe(kst);
  });

  it.each([
    ['2026-10-31', 1, '2026-11-01'],
    ['2026-10-01', -1, '2026-09-30'],
  ])('%s moved %i day is %s', (date, days, expected) => {
    // Act & Assert
    expect(toShiftedDate(date, days)).toBe(expected);
  });

  it.each([
    ['2026-10-18', 0, '2026-10-12', '2026-10-18'],
    ['2026-10-19', 0, '2026-10-19', '2026-10-25'],
    ['2026-10-18', 1, '2026-10-19', '2026-10-25'],
    ['2026-10-18', -1, '2026-10-05', '2026-10-11'],
  ])('the week of %s shifted %i runs Monday %s to Sunday %s', (date, weeks, monday, sunday) => {
    // Act
    const week = toWeekDates(date, weeks);

    // Assert
    expect([week[0], week[6], week.length]).toEqual([monday, sunday, 7]);
  });

  it('names the weekday', () => {
    // Act & Assert
    expect(toWeekday('2026-10-14')).toBe(3);
  });
});

describe('decideMealForHour', () => {
  it.each([
    ['2026-10-14T09:59', 'B'],
    ['2026-10-14T10:00', 'L'],
    ['2026-10-14T14:59', 'L'],
    ['2026-10-14T15:00', 'D'],
  ])('%s KST is %s', (kst, code) => {
    // Act & Assert
    expect(decideMealForHour(at(kst))).toBe(code);
  });
});

describe('toWon', () => {
  it.each([
    [800, '800'],
    [5000, '5,000'],
    [130000, '130,000'],
  ])('%i is %s', (amount, text) => {
    // Act & Assert
    expect(toWon(amount)).toBe(text);
  });
});

describe('toMergedCorners', () => {
  const items = (key: string, title: string, names: string[]): MealsScreenCorner => ({
    kind: 'items',
    key,
    title,
    items: names.map((name) => ({ name, kind: 'single', dishes: [], options: [], tags: [] })),
  });
  const raw = (key: string, title: string): MealsScreenCorner => ({ kind: 'raw', key, title, text: '원문' });

  it("joins a run of same-titled corners, keeping the first key and every item's order", () => {
    // Act
    const merged = toMergedCorners([items('0', '한식', ['곰탕']), items('1', '한식', ['덮밥']), items('2', '한식', ['만두'])]);

    // Assert
    expect(merged).toEqual([items('0', '한식', ['곰탕', '덮밥', '만두'])]);
  });

  it('leaves apart same titles that are not next to each other, and any raw corner', () => {
    // Arrange
    const corners = [items('0', 'CORNER1', ['a']), items('1', 'CORNER2', ['b']), items('2', 'CORNER1', ['c']), raw('3', 'CORNER1')];

    // Act & Assert
    expect(toMergedCorners(corners)).toEqual(corners);
  });
});

describe('toMealsScreenCafeterias', () => {
  it('keeps only the cafeterias that serve something, each meal in order', () => {
    // Act
    const cafeterias = toMealsScreenCafeterias(NSC, 'ko');

    // Assert
    expect(cafeterias.map((c) => [c.title, c.meals.map((m) => m.code).join('')])).toEqual([
      ['구시재식당', 'LDR'],
      ['행단골식당', 'BL'],
      ['해오름식당', 'L'],
      ['THE S LOUNGE', 'LD'],
    ]);
  });

  it('splits fixed boards from the day and names the building and floor', () => {
    // Act
    const hangdangol = toMealsScreenCafeterias(NSC, 'ko').find((c) => c.title === '행단골식당');

    // Assert
    const lunch = hangdangol?.meals.find((m) => m.code === 'L');
    expect(hangdangol?.subtitle).toBe('학생회관 · 1층');
    expect(lunch?.daily.map((c) => c.title)).toEqual(['봄이온소반 · 1F', '나폴리폴리 · 2F']);
    expect(lunch?.fixed).toHaveLength(3);
  });

  it('merges a run of same-named cells into one corner', () => {
    // Act
    const haeoreum = toMealsScreenCafeterias(NSC, 'ko').find((c) => c.title === '해오름식당');

    // Assert
    const lunch = haeoreum?.meals.find((m) => m.code === 'L');
    expect(lunch?.daily.map((c) => c.title)).toEqual(['한식']);
  });

  it('shows the school text for a corner nothing usable was parsed from', () => {
    // Arrange
    const raw = {
      date: '2026-10-14',
      campus: 'hssc' as const,
      cafeterias: [
        {
          id: 'x',
          name: { ko: '가', en: 'A' },
          meals: [{ code: 'L' as const, corners: [{ name: 'c', isFixedMenu: false, items: [], needsReview: true, rawText: '원문' }] }],
        },
      ],
    };

    // Act
    const cafeterias = toMealsScreenCafeterias(raw, 'en');

    // Assert
    expect(cafeterias[0]?.title).toBe('A');
    expect(cafeterias[0]?.meals[0]?.daily).toEqual([{ kind: 'raw', key: '0-c', title: 'c', text: '원문' }]);
  });

  it('has nothing on a day with no menu', () => {
    // Act & Assert
    expect(toMealsScreenCafeterias({ ...NSC, cafeterias: NSC.cafeterias.map((c) => ({ ...c, meals: [] })) }, 'ko')).toEqual([]);
  });
});

describe('toMealsScreenTabs', () => {
  const cafeterias = toMealsScreenCafeterias(NSC, 'ko');
  const byTitle = (title: string) => cafeterias.find((c) => c.title === title)!;
  const gusijae = byTitle('구시재식당');
  const summary = (tabs: ReturnType<typeof toMealsScreenTabs>) =>
    tabs.map((tab) => `${tab.code}${tab.closed === 'over' ? 'x' : '+'}`);

  it.each([
    ['구시재식당', ['L+', 'D+', 'R+']],
    ['행단골식당', ['B+', 'L+']],
    ['해오름식당', ['L+']],
  ])('shows only the meals %s serves, in its order, with no tab for one it does not', (title, expected) => {
    // Act & Assert
    expect(summary(toMealsScreenTabs(byTitle(title), false, at('2026-10-14T12:00')))).toEqual(expected);
  });

  it.each([
    ['2026-10-14T14:59', ['L+', 'D+', 'R+']],
    ['2026-10-14T15:00', ['Lx', 'D+', 'R+']],
    ['2026-10-14T20:00', ['Lx', 'Dx', 'R+']],
  ])('greys a meal that is over at %s KST, today only', (kst, expected) => {
    // Act & Assert
    expect(summary(toMealsScreenTabs(gusijae, true, at(kst)))).toEqual(expected);
    expect(summary(toMealsScreenTabs(gusijae, false, at(kst)))).toEqual(['L+', 'D+', 'R+']);
  });
});
