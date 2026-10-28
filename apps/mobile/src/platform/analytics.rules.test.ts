import { describe, expect, test } from 'vitest';
import {
  asEntrySource,
  isPageReturn,
  campaignSrc,
  DEFAULT_PARAM_COUNT,
  firstSinceLaunch,
  foreignParams,
  MAX_PARAMS,
  notifPermValue,
  sanitizeParams,
  TAB_SWITCH_MARK_MS,
  tabSwitchCause,
  withEntrySource,
} from './analytics.rules';

describe('sanitizeParams', () => {
  test('keeps strings and finite numbers, spells booleans, drops the absent', () => {
    expect(sanitizeParams({ a: 'x', b: 3, c: true, d: false, e: undefined, f: null, g: NaN, h: Infinity })).toStrictEqual({
      a: 'x',
      b: 3,
      c: 'true',
      d: 'false',
    });
  });

  test('cuts a value at 100 characters', () => {
    expect(sanitizeParams({ a: 'x'.repeat(150) }).a).toBe('x'.repeat(100));
  });

  test('drops bad and reserved names', () => {
    expect(sanitizeParams({ '1a': 1, 'a b': 1, firebase_x: 1, google_x: 1, ga_x: 1, ['a'.repeat(41)]: 1, ok_1: 1 })).toStrictEqual({
      ok_1: 1,
    });
  });

  test('leaves room for the default params', () => {
    const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, i]));
    expect(Object.keys(sanitizeParams(many)).length).toBe(MAX_PARAMS - DEFAULT_PARAM_COUNT);
  });
});

describe('foreignParams', () => {
  test('namespaces flat values and drops the rest', () => {
    expect(foreignParams({ page: 'timetable', day: 2, ok: true, nested: { a: 1 }, 'Bad-Key': 'x' })).toStrictEqual({
      p_page: 'timetable',
      p_day: 2,
      p_ok: true,
    });
  });

  test('is empty for anything that is not a plain object', () => {
    for (const raw of [undefined, null, 'x', 3, [1, 2]]) expect(foreignParams(raw)).toStrictEqual({});
  });

  test('caps the count', () => {
    const many = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`k${i}`, i]));
    expect(Object.keys(foreignParams(many)).length).toBe(10);
  });
});

describe('campaignSrc', () => {
  test('accepts a short slug only', () => {
    expect(campaignSrc('poster_a-1')).toBe('poster_a-1');
    for (const v of [undefined, '', 'Poster', 'a b', 'x'.repeat(33), 3, ['a']]) expect(campaignSrc(v)).toBe(undefined);
  });
});

describe('isPageReturn: a page pushed back by closing the place it opened', () => {
  test('is a return only for the source the place close writes', () => {
    expect(isPageReturn('return')).toBe(true);
    for (const v of [undefined, 'tab', 'other', 'RETURN']) expect(isPageReturn(v)).toBe(false);
  });
});

describe('asEntrySource', () => {
  test('keeps a known source that crossed a route as a string', () => {
    expect(asEntrySource('home_tile')).toBe('home_tile');
    expect(asEntrySource('home_feed')).toBe('home_feed');
    expect(asEntrySource('place_sheet')).toBe('place_sheet');
  });

  test('anything else is other', () => {
    for (const v of [undefined, '', 'HOME_TILE', 'home tile', 3, ['push']]) expect(asEntrySource(v)).toBe('other');
  });
});

describe('withEntrySource', () => {
  test('adds the source as the first or the next query param', () => {
    expect(withEntrySource('/subway', 'tab')).toBe('/subway?source=tab');
    expect(withEntrySource('/subway?station=jeongja&line=K2', 'push')).toBe('/subway?station=jeongja&line=K2&source=push');
    expect(withEntrySource('/bus/schedule?', 'sdui')).toBe('/bus/schedule?source=sdui');
  });

  test('keeps a fragment last', () => {
    expect(withEntrySource('/meals?day=1#lunch', 'home_tile')).toBe('/meals?day=1&source=home_tile#lunch');
    expect(withEntrySource('/meals#lunch', 'home_tile')).toBe('/meals?source=home_tile#lunch');
  });

  test('a path that already names a source keeps it', () => {
    expect(withEntrySource('/subway?source=deeplink&station=a', 'tab')).toBe('/subway?source=deeplink&station=a');
    expect(withEntrySource('/subway?station=a&source=x', 'tab')).toBe('/subway?station=a&source=x');
  });

  test('a param that only ends in source is not one', () => {
    expect(withEntrySource('/x?datasource=a', 'tab')).toBe('/x?datasource=a&source=tab');
  });

  test('what it adds reads back as the same source', () => {
    const query = withEntrySource('/subway?station=a', 'line_sheet').split('?')[1] ?? '';
    expect(asEntrySource(new URLSearchParams(query).get('source'))).toBe('line_sheet');
  });
});

describe('notifPermValue', () => {
  test('names each permission state, and fits a user property value (36 characters)', () => {
    const states = ['authorized', 'provisional', 'denied', 'notDetermined'] as const;
    expect(states.map(notifPermValue)).toStrictEqual(['granted', 'provisional', 'denied', 'undetermined']);
    for (const value of states.map(notifPermValue)) expect(value.length <= 36, value).toBe(true);
  });
});

describe('tabSwitchCause: what the app said would switch the tab', () => {
  const MARK = { tab: 'transit', cause: 'chip', at: 1_000 } as const;

  test('a switch to the marked tab soon after the mark takes its cause', () => {
    expect(tabSwitchCause(MARK, 'transit', 1_000 + TAB_SWITCH_MARK_MS)).toBe('chip');
  });

  test('a switch with no mark, to another tab, or after the mark went stale is the user\'s own', () => {
    expect(tabSwitchCause(null, 'transit', 1_000)).toBeUndefined();
    expect(tabSwitchCause(MARK, 'home', 1_100)).toBeUndefined();
    expect(tabSwitchCause(MARK, 'transit', 1_001 + TAB_SWITCH_MARK_MS)).toBeUndefined();
  });
});

describe('firstSinceLaunch: the time to a first action, once per process', () => {
  test('answers the time since launch the first time only', () => {
    // Arrange
    const first = firstSinceLaunch(1_000);

    // Act
    const answers = [first(4_250), first(9_000), first(12_000)];

    // Assert
    expect(answers).toEqual([3_250, undefined, undefined]);
  });

  test('never answers a negative time for a clock that stepped back', () => {
    // Arrange
    const first = firstSinceLaunch(5_000);

    // Act / Assert
    expect(first(4_000)).toBe(0);
  });
});
