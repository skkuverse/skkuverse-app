import { describe, expect, it } from 'vitest';
import type { TranslationKey } from '@skkuverse/shared';
import type { BuildingConnection, FloorInfo } from '../building.types';
import { floorIndexOfSpace, toChipsByFloorBadge, toFloorSections } from './floor-guide.rules';

const tpl = (key: TranslationKey, ...args: (string | number)[]) => `${key}:${args.join(',')}`;
const space = (spaceCd: string) => ({ spaceCd, name: { ko: spaceCd, en: spaceCd } });

const FLOORS: FloorInfo[] = [
  { floor: { ko: '지하1층', en: 'B1' }, spaces: [space('1B101'), space('1B102')] },
  { floor: { ko: '1층', en: '1F' }, spaces: [space('10101')] },
  { floor: { ko: '2층', en: '2F' }, spaces: [space('10201')] },
];

const passage = (targetSkkuId: number, target: string, from: string, to: string): BuildingConnection => ({
  targetSkkuId,
  targetName: { ko: target, en: `${target} Hall` },
  fromFloor: { ko: from, en: from },
  toFloor: { ko: to, en: to },
});

const PASSAGES: BuildingConnection[] = [
  passage(9, '국제관', '지하1층', '1층'),
  passage(7, '경영관', '지하1층', '지하2층'),
  passage(7, '경영관', '2층', '3층'),
];

describe('floorIndexOfSpace', () => {
  it('opens the floor that holds the highlighted space', () => {
    // Act & Assert
    expect(floorIndexOfSpace(FLOORS, '1B102')).toBe(0);
    expect(floorIndexOfSpace(FLOORS, '10201')).toBe(2);
  });

  it('opens no floor without a highlight, or for a space the building does not list', () => {
    // Act & Assert
    expect(floorIndexOfSpace(FLOORS, undefined)).toBe(null);
    expect(floorIndexOfSpace(FLOORS, '')).toBe(null);
    expect(floorIndexOfSpace(FLOORS, '99999')).toBe(null);
    expect(floorIndexOfSpace([], '1B101')).toBe(null);
  });
});

describe('toFloorSections', () => {
  it('titles each floor in the app language, badges it, and counts its spaces', () => {
    // Act
    const ko = toFloorSections(FLOORS, 'ko', tpl);
    const en = toFloorSections(FLOORS, 'en', tpl);

    // Assert
    expect(ko.map(({ title, badge, subtitle }) => [title, badge, subtitle])).toStrictEqual([
      ['지하1층', 'B1', 'building.unitCount:2'],
      ['1층', '1F', 'building.unitCount:1'],
      ['2층', '2F', 'building.unitCount:1'],
    ]);
    expect(en.map(({ title, badge }) => [title, badge])).toStrictEqual([
      ['B1', 'B1'],
      ['1F', '1F'],
      ['2F', '2F'],
    ]);
    expect(ko[0].items).toBe(FLOORS[0].spaces);
  });
});

describe('toChipsByFloorBadge', () => {
  it('puts each passage on the floor it leaves from, named for the building and floor it reaches', () => {
    // Arrange
    const sections = toFloorSections(FLOORS, 'ko', tpl);

    // Act
    const chips = toChipsByFloorBadge(PASSAGES, 'ko');

    // Assert
    expect(sections.map((s) => chips[s.badge ?? ''] ?? [])).toStrictEqual([
      [
        { label: '국제관 1F', targetSkkuId: 9 },
        { label: '경영관 B2', targetSkkuId: 7 },
      ],
      [],
      [{ label: '경영관 3F', targetSkkuId: 7 }],
    ]);
  });

  it('names the chips in English when the app is', () => {
    // Arrange
    const sections = toFloorSections(FLOORS, 'en', tpl);

    // Act
    const chips = toChipsByFloorBadge(PASSAGES, 'en');

    // Assert
    expect(chips[sections[2].badge ?? '']).toStrictEqual([{ label: '경영관 Hall 3F', targetSkkuId: 7 }]);
  });

  it('gives a building without passages no chips', () => {
    // Act
    const chips = toChipsByFloorBadge([], 'ko');

    // Assert
    expect(Object.keys(chips)).toStrictEqual([]);
  });
});
