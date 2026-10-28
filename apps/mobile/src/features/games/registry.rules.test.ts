/**
 * What each game's result card and board say (spec games/game-host, "Results,
 * revives, overlays and copy stay native"): the headline for every way a run
 * ends, the detail rows under the score, how a score reads, and the flags and
 * colours the host draws with. The expected values were written from the
 * registry as it stood while it still imported the game packages, so moving a
 * value into the app cannot change what a player sees.
 */
import { describe, expect, it } from 'vitest';
import type { TranslationKey } from '@skkuverse/shared';
import { FIRST_PARTY_GAMES, scoreText } from './registry.rules';

/** Echoes the key and its arguments, so a row pins both. */
const tpl = (key: TranslationKey, ...args: (string | number)[]) => (args.length ? `${key}(${args.join(',')})` : key);
const t = (key: TranslationKey) => `t:${key}`;
const over = (hit: string | null) => ({ score: 1, ticks: 1, hit, revives: 0, revivesLeft: 0 });

describe('flags and colours', () => {
  it.each([
    ['wave-run', { titleKey: 'game.waveRun.title', homeEmoji: '\u{1F3C4}', order: 'desc', leaderboard: { maxEntry: 99999 }, revives: true, pauses: true, keyboard: false, sound: true, background: '#073E32', scrim: 'rgba(4,32,26,0.5)' }],
    ['subway-typing', { titleKey: 'game.subwayTyping.title', homeEmoji: '\u{1F687}', order: 'asc', leaderboard: { maxEntry: 3_600_000 }, revives: false, pauses: false, keyboard: true, sound: true, background: '#FFFFFF', scrim: 'rgba(0,0,0,0.4)' }],
    ['apple-game', { titleKey: 'game.appleGame.title', homeEmoji: '\u{1F34E}', order: 'desc', leaderboard: null, revives: false, pauses: true, keyboard: false, sound: true, background: '#FFFFFF', scrim: 'rgba(0,0,0,0.4)' }],
    ['suika-game', { titleKey: 'game.suikaGame.title', homeEmoji: '\u{1F349}', order: 'desc', leaderboard: null, revives: true, pauses: true, keyboard: false, sound: true, background: '#CC8C52', scrim: 'rgba(0,0,0,0.4)' }],
    ['building-stack', { titleKey: 'game.buildingStack.title', homeEmoji: '\u{1F3D7}\u{FE0F}', order: 'desc', leaderboard: null, revives: false, pauses: true, keyboard: false, sound: true, background: '#9FD6FF', scrim: 'rgba(0,0,0,0.4)' }],
    ['bigger-building', { titleKey: 'game.biggerBuilding.title', homeEmoji: '\u{1F3D9}\u{FE0F}', order: 'desc', leaderboard: null, revives: false, pauses: true, keyboard: false, sound: true, background: '#000000', scrim: 'rgba(0,0,0,0.4)' }],
  ] as const)('%s', (id, expected) => {
    const game = FIRST_PARTY_GAMES[id];
    expect({
      titleKey: game.titleKey,
      homeEmoji: game.homeEmoji,
      order: game.score.order,
      leaderboard: game.leaderboard && { maxEntry: game.leaderboard.maxEntry },
      revives: game.revives,
      pauses: game.pauses,
      keyboard: game.keyboard,
      sound: game.sound,
      background: game.background,
      scrim: game.scrim,
    }).toStrictEqual(expected);
  });
});

describe('headlines', () => {
  it.each([
    ['wave-run', 'wave', 'game.waveRun.hit.wave'],
    ['wave-run', 'bus', 'game.waveRun.hit.bus'],
    ['wave-run', 'ripple', 'game.waveRun.hit.ripple'],
    ['wave-run', null, 'game.waveRun.hit.ripple'],
    ['wave-run', 'other', 'game.waveRun.hit.ripple'],
    ['subway-typing', 'arrived', 'game.subwayTyping.arrived'],
    ['subway-typing', null, 'game.subwayTyping.arrived'],
    ['apple-game', 'clear', 'game.appleGame.hit.clear'],
    ['apple-game', 'stuck', 'game.appleGame.hit.stuck'],
    ['apple-game', 'time', 'game.appleGame.hit.time'],
    ['apple-game', null, 'game.appleGame.hit.time'],
    ['suika-game', 'overflow', 'game.suikaGame.hit.overflow'],
    ['suika-game', null, 'game.suikaGame.hit.overflow'],
    ['building-stack', 'missed', 'game.buildingStack.hit.missed'],
    ['building-stack', 'toppled', 'game.buildingStack.hit.toppled'],
    ['building-stack', null, 'game.buildingStack.hit.missed'],
    ['bigger-building', 'wrong', 'game.biggerBuilding.hit.wrong'],
    ['bigger-building', 'conquered', 'game.biggerBuilding.hit.conquered'],
    ['bigger-building', null, 'game.biggerBuilding.hit.wrong'],
  ] as const)('%s, hit %s', (id, hit, expected) => {
    expect(FIRST_PARTY_GAMES[id].headline(over(hit))).toBe(expected);
  });
});

describe('scores', () => {
  it.each([
    ['wave-run', 0, '0', 't:game.pointUnit'],
    ['wave-run', 12345, '12,345', 't:game.pointUnit'],
    ['subway-typing', 0, '0:00.00', null],
    ['subway-typing', -5, '0:00.00', null],
    ['subway-typing', 9, '0:00.00', null],
    ['subway-typing', 83456, '1:23.45', null],
    ['subway-typing', 3_600_000, '60:00.00', null],
    ['apple-game', 170, '170', 't:game.pointUnit'],
    ['apple-game', 1234, '1,234', 't:game.pointUnit'],
    ['suika-game', 2468, '2,468', 't:game.pointUnit'],
    ['building-stack', 0, '0', 't:game.buildingUnit'],
    ['building-stack', 1234, '1,234', 't:game.buildingUnit'],
    ['bigger-building', 0, '0', 't:game.correctUnit'],
    ['bigger-building', 1234, '1,234', 't:game.correctUnit'],
  ] as const)('%s %d', (id, score, formatted, unit) => {
    const game = FIRST_PARTY_GAMES[id];
    expect(game.score.format(score)).toBe(formatted);
    expect(scoreText(game, score, t)).toBe(unit ? `${formatted}${unit}` : formatted);
  });
});

describe('detail rows', () => {
  it('wave-run has none', () => {
    expect(FIRST_PARTY_GAMES['wave-run'].details).toBeUndefined();
  });

  it.each([
    [
      'subway-typing',
      { kpm: 312, accuracy: 97, typos: 4 },
      [
        { labelKey: 'game.subwayTyping.kpm', value: 'game.subwayTyping.kpmValue(312)' },
        { labelKey: 'game.subwayTyping.accuracy', value: '97%' },
        { labelKey: 'game.subwayTyping.typos', value: 'game.subwayTyping.typosValue(4)' },
      ],
    ],
    ['subway-typing', { accuracy: 100, typos: 0 }, [
      { labelKey: 'game.subwayTyping.accuracy', value: '100%' },
      { labelKey: 'game.subwayTyping.typos', value: 'game.subwayTyping.typosValue(0)' },
    ]],
    ['subway-typing', {}, []],
    [
      'apple-game',
      { moves: 12, biggest: 5, misses: 3, secondsLeft: 17 },
      [
        { labelKey: 'game.appleGame.moves', value: 'game.appleGame.movesValue(12)' },
        { labelKey: 'game.appleGame.biggest', value: 'game.appleGame.biggestValue(5)' },
        { labelKey: 'game.appleGame.misses', value: 'game.appleGame.missesValue(3)' },
        { labelKey: 'game.appleGame.secondsLeft', value: 'game.appleGame.secondsLeftValue(17)' },
      ],
    ],
    ['apple-game', { moves: 0, biggest: 2, misses: 0, secondsLeft: 0 }, [
      { labelKey: 'game.appleGame.moves', value: 'game.appleGame.movesValue(0)' },
      { labelKey: 'game.appleGame.biggest', value: 'game.appleGame.biggestValue(2)' },
      { labelKey: 'game.appleGame.misses', value: 'game.appleGame.missesValue(0)' },
    ]],
    ['apple-game', {}, []],
    [
      'suika-game',
      { biggestTier: 10, merges: 42, watermelons: 1 },
      [
        { labelKey: 'game.suikaGame.biggestTier', value: 'game.suikaGame.fruit.watermelon' },
        { labelKey: 'game.suikaGame.merges', value: 'game.suikaGame.mergesValue(42)' },
        { labelKey: 'game.suikaGame.watermelons', value: 'game.suikaGame.watermelonsValue(1)' },
      ],
    ],
    ['suika-game', { biggestTier: 11, merges: 0, watermelons: 0 }, [
      { labelKey: 'game.suikaGame.merges', value: 'game.suikaGame.mergesValue(0)' },
    ]],
    ['suika-game', { biggestTier: -1 }, []],
    ['suika-game', {}, []],
    [
      'building-stack',
      { perfects: 7, bestCombo: 3, stage: 4, campus: 0 },
      [
        { labelKey: 'game.buildingStack.perfects', value: 'game.buildingStack.perfectsValue(7)' },
        { labelKey: 'game.buildingStack.bestCombo', value: 'game.buildingStack.bestComboValue(3)' },
        { labelKey: 'game.buildingStack.stage', value: 'game.buildingStack.stageValue(4)' },
        { labelKey: 'game.buildingStack.campus', value: 'campus.hssc' },
      ],
    ],
    ['building-stack', { perfects: 0, bestCombo: 0, stage: 1, campus: 1 }, [
      { labelKey: 'game.buildingStack.perfects', value: 'game.buildingStack.perfectsValue(0)' },
      { labelKey: 'game.buildingStack.bestCombo', value: 'game.buildingStack.bestComboValue(0)' },
      { labelKey: 'game.buildingStack.stage', value: 'game.buildingStack.stageValue(1)' },
      { labelKey: 'game.buildingStack.campus', value: 'campus.nsc' },
    ]],
    ['building-stack', { campus: 2 }, []],
    ['building-stack', {}, []],
    ['bigger-building', { campus: 0, total: 41 }, [
      { labelKey: 'game.biggerBuilding.campus', value: 'campus.hssc' },
      { labelKey: 'game.biggerBuilding.total', value: 'game.biggerBuilding.totalValue(41)' },
    ]],
    ['bigger-building', { campus: 1, total: 57 }, [
      { labelKey: 'game.biggerBuilding.campus', value: 'campus.nsc' },
      { labelKey: 'game.biggerBuilding.total', value: 'game.biggerBuilding.totalValue(57)' },
    ]],
    ['bigger-building', { campus: 2, total: 98 }, [
      { labelKey: 'game.biggerBuilding.campus', value: 'game.biggerBuilding.campusBoth' },
      { labelKey: 'game.biggerBuilding.total', value: 'game.biggerBuilding.totalValue(98)' },
    ]],
    ['bigger-building', { campus: 3 }, []],
    ['bigger-building', {}, []],
  ] as const)('%s %o', (id, stats, expected) => {
    expect(FIRST_PARTY_GAMES[id].details?.(stats, tpl)).toStrictEqual(expected);
  });

  it.each([
    [0, 'ginkgo'],
    [1, 'strawberry'],
    [2, 'grape'],
    [3, 'chestnut'],
    [4, 'persimmon'],
    [5, 'apple'],
    [6, 'pear'],
    [7, 'peach'],
    [8, 'pineapple'],
    [9, 'melon'],
    [10, 'watermelon'],
  ])('suika-game names tier %d the %s', (tier, fruit) => {
    expect(FIRST_PARTY_GAMES['suika-game'].details?.({ biggestTier: tier }, tpl)).toStrictEqual([
      { labelKey: 'game.suikaGame.biggestTier', value: `game.suikaGame.fruit.${fruit}` },
    ]);
  });
});
