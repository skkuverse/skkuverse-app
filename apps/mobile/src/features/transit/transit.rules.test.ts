/**
 * The transit tab's sections under the shared map (ADR 0022 d5, owner
 * decision 2026-10-24): the selected campus's sections and the untagged ones,
 * in the server order. And the root sheet's pull-down, the tab's measurement.
 */
import { describe, expect, it } from 'vitest';
import { MAP_SHEET_PROFILES } from '@/features/map/sheet-stack.constants';
import { isRootPullDown, sectionsForCampus, toInfoUrl, withoutSectionTitles } from './transit.rules';
import type { TransitSection } from './transit.types';

describe('isRootPullDown: the transit root pulled down from its opening level toward the map', () => {
  const opening = MAP_SHEET_PROFILES.transitRoot.opening;

  it('is a settle below the opening, from the opening or above it', () => {
    // Act & Assert
    expect(isRootPullDown('max', 'min', opening)).toBe(true);
    expect(isRootPullDown('page', 'min', opening)).toBe(true);
  });

  it('is not a settle that stays at or above the opening', () => {
    // Act & Assert
    expect(isRootPullDown('max', 'page', opening)).toBe(false);
    expect(isRootPullDown('page', 'max', opening)).toBe(false);
    expect(isRootPullDown('max', 'max', opening)).toBe(false);
  });

  it('is not a settle that was already below the opening, as a tab switch re-reports the remembered level', () => {
    // Act & Assert
    expect(isRootPullDown('min', 'min', opening)).toBe(false);
  });

  it('on the three-level root, which opens at max, a pull to mid or min is a pull-down', () => {
    // Act & Assert
    expect(MAP_SHEET_PROFILES.transitRoot.levels).toEqual(['min', 'mid', 'max']);
    expect(opening).toBe('max');
    expect(isRootPullDown('max', 'mid', opening)).toBe(true);
    expect(isRootPullDown('max', 'min', opening)).toBe(true);
    expect(isRootPullDown('mid', 'min', opening)).toBe(false);
  });

});

const section = (id: string, campus: TransitSection['campus']): TransitSection => ({
  type: 'item_list',
  id,
  title: null,
  campus,
  items: [],
});

const SERVED = [section('campus', null), section('hssc', 'hssc'), section('nsc', 'nsc')];

const ids = (sections: readonly TransitSection[]) => sections.map((s) => s.id);

describe('sectionsForCampus', () => {
  it.each([
    ['hssc', ['campus', 'hssc']],
    ['nsc', ['campus', 'nsc']],
  ] as const)('shows the untagged sections and those of %s only', (campus, expected) => {
    // Act
    const shown = sectionsForCampus(SERVED, campus);

    // Assert
    expect(ids(shown)).toEqual(expected);
  });

  it('keeps the server order of what it shows', () => {
    // Arrange
    const served = [
      section('nsc-a', 'nsc'),
      section('hssc-a', 'hssc'),
      section('both', null),
      section('nsc-b', 'nsc'),
    ];

    // Act
    const shown = sectionsForCampus(served, 'nsc');

    // Assert
    expect(ids(shown)).toEqual(['nsc-a', 'both', 'nsc-b']);
  });

  it('shows every section of an untagged layout', () => {
    // Arrange
    const served = [section('a', null), section('b', null)];

    // Act
    const shown = sectionsForCampus(served, 'hssc');

    // Assert
    expect(ids(shown)).toEqual(['a', 'b']);
  });
});

describe('withoutSectionTitles', () => {
  const titled = (id: string, title: string | null, campus: TransitSection['campus'], itemIds: string[]): TransitSection => ({
    ...section(id, campus),
    title,
    items: itemIds.map((itemId) => ({ kind: 'link', id: itemId }) as unknown as TransitSection['items'][number]),
  });
  const SERVED_TITLED = [
    titled('campus', null, null, ['shuttle']),
    titled('hssc', '인사캠', 'hssc', ['h1', 'h2']),
    titled('nsc', '자과캠', 'nsc', ['n1']),
  ];

  it('lists the inter-campus rows then the selected campus rows, in order, with no title', () => {
    const shown = withoutSectionTitles(sectionsForCampus(SERVED_TITLED, 'hssc'));

    expect(shown.map((s) => s.title)).toEqual([null, null]);
    expect(shown.flatMap((s) => s.items.map((i) => i.id))).toEqual(['shuttle', 'h1', 'h2']);
  });

  it('keeps each section id and campus, which the row taps report', () => {
    const shown = withoutSectionTitles(SERVED_TITLED);

    expect(shown.map((s) => [s.id, s.campus])).toEqual([['campus', null], ['hssc', 'hssc'], ['nsc', 'nsc']]);
  });

  it('does not change the served sections', () => {
    withoutSectionTitles(SERVED_TITLED);

    expect(SERVED_TITLED[1]?.title).toBe('인사캠');
  });
});

describe('toInfoUrl: the url of the `info` feature a screen config carries', () => {
  it.each([
    ['the info feature', [{ type: 'notice' }, { type: 'info', url: 'https://x.test/i' }], 'https://x.test/i'],
    ['no info feature', [{ type: 'notice', url: 'https://x.test/n' }], undefined],
    ['no features', [], undefined],
  ])('%s', (_name, features, expected) => {
    // Act & Assert
    expect(toInfoUrl(features)).toBe(expected);
  });
});
