import { describe, expect, test } from 'vitest';
import type { SubwayChoice, SubwayDirectionKey } from '@skkuverse/shared';
import {
  decideSubwayViewSource,
  toSubwayScreenChoice,
  type SubwayChoiceSource,
} from './subway.rules';
import type { SubwayLineArrivals } from './subway.types';

const line = (code: string, directions: SubwayDirectionKey[] = ['up', 'down']): SubwayLineArrivals => ({
  line: { code, name: code, color: '000000', marker: { text: code, color: '000000' } },
  directions: directions.map((direction) => ({ direction, name: direction, nextStationName: null, trains: [] })),
});

// 정자: two lines, each with both directions.
const TWO_LINES = [line('D1'), line('K2')];

interface ChoiceCase {
  name: string;
  lines: SubwayLineArrivals[];
  lineParam: string | undefined;
  saved: SubwayChoice | undefined;
  expected: { line: string; direction: SubwayDirectionKey; source: SubwayChoiceSource };
}

describe('toSubwayScreenChoice', () => {
  test.each<ChoiceCase>([
    {
      name: 'no saved state opens the first line, up',
      lines: TWO_LINES,
      lineParam: undefined,
      saved: undefined,
      expected: { line: 'D1', direction: 'up', source: 'default' },
    },
    {
      name: 'an empty saved entry is no saved state',
      lines: TWO_LINES,
      lineParam: undefined,
      saved: {},
      expected: { line: 'D1', direction: 'up', source: 'default' },
    },
    {
      name: "the link's line overrides the saved line",
      lines: TWO_LINES,
      lineParam: 'K2',
      saved: { line: 'D1' },
      expected: { line: 'K2', direction: 'up', source: 'param' },
    },
    {
      name: "the link's line still restores that line's saved direction",
      lines: TWO_LINES,
      lineParam: 'K2',
      saved: { line: 'D1', direction: { K2: 'down' } },
      expected: { line: 'K2', direction: 'down', source: 'param' },
    },
    {
      name: 'a link line the station lacks falls through to the saved line',
      lines: TWO_LINES,
      lineParam: 'XX',
      saved: { line: 'K2' },
      expected: { line: 'K2', direction: 'up', source: 'remembered' },
    },
    {
      name: 'the saved line and its own direction are restored',
      lines: TWO_LINES,
      lineParam: undefined,
      saved: { line: 'K2', direction: { D1: 'up', K2: 'down' } },
      expected: { line: 'K2', direction: 'down', source: 'remembered' },
    },
    {
      name: "another line's saved direction does not carry over",
      lines: TWO_LINES,
      lineParam: undefined,
      saved: { line: 'D1', direction: { K2: 'down' } },
      expected: { line: 'D1', direction: 'up', source: 'remembered' },
    },
    {
      name: 'a saved line the station no longer serves opens the first line',
      lines: TWO_LINES,
      lineParam: undefined,
      saved: { line: 'XX' },
      expected: { line: 'D1', direction: 'up', source: 'default' },
    },
    {
      name: "a saved line that is gone still restores the first line's direction",
      lines: TWO_LINES,
      lineParam: undefined,
      saved: { line: 'XX', direction: { D1: 'down' } },
      expected: { line: 'D1', direction: 'down', source: 'remembered' },
    },
    {
      name: 'a saved direction the line lacks (a terminus) falls back to the default',
      lines: [line('D1', ['up'])],
      lineParam: undefined,
      saved: { direction: { D1: 'down' } },
      expected: { line: 'D1', direction: 'up', source: 'default' },
    },
    {
      name: 'a line with only the down direction opens on it',
      lines: [line('D1', ['down'])],
      lineParam: undefined,
      saved: { direction: { D1: 'up' } },
      expected: { line: 'D1', direction: 'down', source: 'default' },
    },
    {
      name: 'a single-line station restores its direction',
      lines: [line('4')],
      lineParam: undefined,
      saved: { direction: { '4': 'down' } },
      expected: { line: '4', direction: 'down', source: 'remembered' },
    },
    {
      name: 'a single-line station opens on its only line whatever the link names',
      lines: [line('4')],
      lineParam: 'K2',
      saved: undefined,
      expected: { line: '4', direction: 'up', source: 'default' },
    },
    {
      name: 'an empty link line is no link line',
      lines: TWO_LINES,
      lineParam: '',
      saved: undefined,
      expected: { line: 'D1', direction: 'up', source: 'default' },
    },
  ])('$name', ({ lines, lineParam, saved, expected }) => {
    // Act
    const choice = toSubwayScreenChoice(lines, { lineParam, saved });

    // Assert
    expect(choice && {
      line: choice.line.line.code,
      direction: choice.direction.direction,
      source: choice.source,
    }).toEqual(expected);
  });

  test('a station with no lines has nothing to show', () => {
    // Act & Assert
    expect(toSubwayScreenChoice([], { lineParam: 'D1', saved: { line: 'D1' } })).toBeUndefined();
  });
});

describe('decideSubwayViewSource', () => {
  test.each([
    { tap: 'line', picked: 'param', expected: 'line_tap' },
    { tap: 'direction', picked: 'remembered', expected: 'direction_tap' },
    { tap: null, picked: 'param', expected: 'param' },
    { tap: null, picked: 'remembered', expected: 'remembered' },
    { tap: null, picked: 'default', expected: 'default' },
  ] as const)('tap $tap, picked by $picked → $expected', ({ tap, picked, expected }) => {
    // Act & Assert
    expect(decideSubwayViewSource(tap, picked)).toBe(expected);
  });
});
