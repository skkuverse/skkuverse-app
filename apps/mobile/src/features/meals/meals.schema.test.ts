import { describe, expect, it } from 'vitest';
import { mealsDailySchema } from './meals.schema';
import hssc from './__fixtures__/meals-daily.hssc-2026-10-14.json';
import nsc from './__fixtures__/meals-daily.nsc-2026-10-14.json';

const day = (cafeterias: unknown[]) => ({ date: '2026-10-14', campus: 'hssc', cafeterias });
const cafeteria = (meals: unknown[]) => ({ id: 'x', name: { ko: '가', en: '' }, meals });

describe('mealsDailySchema', () => {
  it("reads the server's published days whole", () => {
    // Act
    const parsedHssc = mealsDailySchema.parse(hssc.data);
    const parsedNsc = mealsDailySchema.parse(nsc.data);

    // Assert
    expect(parsedHssc.cafeterias).toHaveLength(hssc.data.cafeterias.length);
    expect(parsedNsc.cafeterias).toHaveLength(nsc.data.cafeterias.length);
  });

  it('keeps tags, fixed boards, sets and the floor of a corner', () => {
    // Act
    const parsed = mealsDailySchema.parse(nsc.data);

    // Assert
    const hangdangol = parsed.cafeterias.find((c) => c.name.ko === '행단골식당');
    const breakfast = hangdangol?.meals.find((m) => m.code === 'B');
    expect(breakfast?.corners[0]?.items[0]?.tags).toEqual(['천원의아침밥', '일반식']);
    expect(breakfast?.corners[0]?.floor).toBe('1F');
    const lunch = hangdangol?.meals.find((m) => m.code === 'L');
    expect(lunch?.corners.filter((c) => c.isFixedMenu).map((c) => c.name)).toEqual(['가츠엔', '싱푸차이나', '피키피커스']);
    const gusijae = parsed.cafeterias.find((c) => c.name.ko === '구시재식당');
    expect(gusijae?.meals.find((m) => m.code === 'L')?.corners[0]?.items[0]?.kind).toBe('set');
  });

  it('keeps a cafeteria with no menu', () => {
    // Act
    const parsed = mealsDailySchema.parse(nsc.data);

    // Assert
    expect(parsed.cafeterias.find((c) => c.name.ko === '기숙사신관 식당')?.meals).toEqual([]);
  });

  it('fills an empty English name from the Korean one', () => {
    // Act
    const parsed = mealsDailySchema.parse(day([cafeteria([])]));

    // Assert
    expect(parsed.cafeterias[0]?.name).toEqual({ ko: '가', en: '가' });
  });

  it('skips a meal code this build does not know and drops a nameless item alone', () => {
    // Arrange
    const raw = day([
      cafeteria([
        { code: 'Z', corners: [] },
        { code: 'L', corners: [{ name: 'c', items: [{ name: '' }, { name: '밥', priceKrw: 5000, kind: 'combo' }], rawText: '' }] },
      ]),
    ]);

    // Act
    const parsed = mealsDailySchema.parse(raw);

    // Assert
    expect(parsed.cafeterias[0]?.meals.map((m) => m.code)).toEqual(['L']);
    expect(parsed.cafeterias[0]?.meals[0]?.corners[0]?.items).toEqual([
      { name: '밥', priceKrw: 5000, kind: 'single', dishes: [], quantity: undefined, options: [], tags: [] },
    ]);
  });

  it('reads a null price and a missing option price as absent', () => {
    // Arrange
    const item = { name: '밥', priceKrw: null, options: [{ name: '곱빼기', extraKrw: 1000 }, { name: '추가', extraKrw: null }] };

    // Act
    const parsed = mealsDailySchema.parse(day([cafeteria([{ code: 'L', corners: [{ name: 'c', items: [item], rawText: '' }] }])]));

    // Assert
    const parsedItem = parsed.cafeterias[0]?.meals[0]?.corners[0]?.items[0];
    expect(parsedItem?.priceKrw).toBeUndefined();
    expect(parsedItem?.options).toEqual([{ name: '곱빼기', extraKrw: 1000 }]);
  });

  it('fails a response for a campus this build does not know', () => {
    // Act & Assert
    expect(mealsDailySchema.safeParse({ ...day([]), campus: 'mars' }).success).toBe(false);
  });

  it('reads each campus by its exact id and fails a missing or malformed one', () => {
    // Act & Assert
    expect(mealsDailySchema.parse({ ...day([]), campus: 'nsc' }).campus).toBe('nsc');
    for (const campus of [undefined, null, '', 'HSSC', ' hssc', 0, ['hssc'], { id: 'hssc' }]) {
      expect(mealsDailySchema.safeParse({ ...day([]), campus }).success).toBe(false);
    }
  });

  it.each([
    ['meals-daily.hssc-2026-10-14', hssc.data],
    ['meals-daily.nsc-2026-10-14', nsc.data],
  ])('%s reads whole', (_name, data) => {
    // Act & Assert
    expect(mealsDailySchema.parse(data)).toMatchSnapshot();
  });
});
