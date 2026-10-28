import type { TranslationKey } from '@skkuverse/shared';
import type { FirstPartyGame, ResultDetail } from './games.types';

/**
 * CONTRACT(skkuverse-mini): skkuverse-mini/games/suika-game/src/game/fruits.ts orders FRUITS, which a result's
 * `biggestTier` indexes.
 */
const SUIKA_FRUIT_NAME_KEYS: readonly TranslationKey[] = [
  'game.suikaGame.fruit.ginkgo',
  'game.suikaGame.fruit.strawberry',
  'game.suikaGame.fruit.grape',
  'game.suikaGame.fruit.chestnut',
  'game.suikaGame.fruit.persimmon',
  'game.suikaGame.fruit.apple',
  'game.suikaGame.fruit.pear',
  'game.suikaGame.fruit.peach',
  'game.suikaGame.fruit.pineapple',
  'game.suikaGame.fruit.melon',
  'game.suikaGame.fruit.watermelon',
];

/**
 * CONTRACT(skkuverse-mini): skkuverse-mini/games/building-stack/src/campus/school.ts orders CAMPUSES, which a
 * result's `campus` indexes.
 */
const BUILDING_STACK_CAMPUS_KEYS: readonly TranslationKey[] = ['campus.hssc', 'campus.nsc'];

/**
 * CONTRACT(skkuverse-mini): skkuverse-mini/games/bigger-building/src/campus/skku.ts orders CHOICES, which a
 * result's `campus` indexes.
 */
const BIGGER_BUILDING_CAMPUS_KEYS: readonly TranslationKey[] = ['campus.hssc', 'campus.nsc', 'game.biggerBuilding.campusBoth'];

/**
 * CONTRACT(skkuverse-mini): skkuverse-mini/games/subway-typing/src/lib/stats.ts formatTime reads the same
 * `m:ss.cc`.
 */
function formatTime(ms: number): string {
  const centis = Math.floor(Math.max(0, ms) / 10);
  const minutes = Math.floor(centis / 6000);
  const seconds = Math.floor((centis % 6000) / 100);
  const rest = centis % 100;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(rest).padStart(2, '0')}`;
}

/**
 * WHY: its keys are the only game ids the app knows, and it imports no game code: every page is hosted on
 * its game origin (skkuverse-mini `games/<id>/`), so a value a page also uses is copied here beside the
 * page file it mirrors. A game is ranked exactly when it has a `leaderboard`.
 */
const CONFIG = {
  'wave-run': {
    titleKey: 'game.waveRun.title',
    homeEmoji: '\u{1F3C4}',
    headline: ({ hit }) =>
      hit === 'wave' ? 'game.waveRun.hit.wave' : hit === 'bus' ? 'game.waveRun.hit.bus' : 'game.waveRun.hit.ripple',
    score: { order: 'desc', format: (n) => n.toLocaleString(), unitKey: 'game.pointUnit' },
    leaderboard: { maxEntry: 99999 },
    revives: true,
    pauses: true,
    keyboard: false,
    sound: true,
    background: '#073E32',
    scrim: 'rgba(4,32,26,0.5)',
  },
  'subway-typing': {
    titleKey: 'game.subwayTyping.title',
    homeEmoji: '\u{1F687}',
    headline: () => 'game.subwayTyping.arrived',
    // CONTRACT(skkuverse-mini): skkuverse-mini/games/subway-typing/src/bound.ts holds the floor of this time,
    // fastest first.
    score: { order: 'asc', format: formatTime },
    leaderboard: { maxEntry: 3_600_000 },
    details: (stats, tpl) => {
      const rows: ResultDetail[] = [];
      if (stats.kpm !== undefined) rows.push({ labelKey: 'game.subwayTyping.kpm', value: tpl('game.subwayTyping.kpmValue', stats.kpm) });
      if (stats.accuracy !== undefined) rows.push({ labelKey: 'game.subwayTyping.accuracy', value: `${stats.accuracy}%` });
      if (stats.typos !== undefined) rows.push({ labelKey: 'game.subwayTyping.typos', value: tpl('game.subwayTyping.typosValue', stats.typos) });
      return rows;
    },
    revives: false,
    // WHY: a typing run keeps its clock through `game.pause` (the page's Game.tsx).
    pauses: false,
    keyboard: true,
    sound: true,
    // CONTRACT(skkuverse-mini): skkuverse-mini/games/subway-typing/src/layout.ts holds the same BACKGROUND.
    background: '#FFFFFF',
    scrim: 'rgba(0,0,0,0.4)',
  },
  'apple-game': {
    titleKey: 'game.appleGame.title',
    homeEmoji: '\u{1F34E}',
    headline: ({ hit }) =>
      hit === 'clear' ? 'game.appleGame.hit.clear' : hit === 'stuck' ? 'game.appleGame.hit.stuck' : 'game.appleGame.hit.time',
    // WHY: nuts cleared; a full board is 170.
    score: { order: 'desc', format: (n) => n.toLocaleString(), unitKey: 'game.pointUnit' },
    leaderboard: null,
    details: (stats, tpl) => {
      const rows: ResultDetail[] = [];
      if (stats.moves !== undefined) rows.push({ labelKey: 'game.appleGame.moves', value: tpl('game.appleGame.movesValue', stats.moves) });
      if (stats.biggest !== undefined) rows.push({ labelKey: 'game.appleGame.biggest', value: tpl('game.appleGame.biggestValue', stats.biggest) });
      if (stats.misses !== undefined) rows.push({ labelKey: 'game.appleGame.misses', value: tpl('game.appleGame.missesValue', stats.misses) });
      if (stats.secondsLeft) rows.push({ labelKey: 'game.appleGame.secondsLeft', value: tpl('game.appleGame.secondsLeftValue', stats.secondsLeft) });
      return rows;
    },
    revives: false,
    pauses: true,
    keyboard: false,
    sound: true,
    // CONTRACT(skkuverse-mini): skkuverse-mini/games/apple-game/src/layout.ts holds the same BACKGROUND.
    background: '#FFFFFF',
    scrim: 'rgba(0,0,0,0.4)',
  },
  'suika-game': {
    titleKey: 'game.suikaGame.title',
    homeEmoji: '\u{1F349}',
    headline: () => 'game.suikaGame.hit.overflow',
    score: { order: 'desc', format: (n) => n.toLocaleString(), unitKey: 'game.pointUnit' },
    leaderboard: null,
    details: (stats, t) => {
      const rows: ResultDetail[] = [];
      const fruit = stats.biggestTier === undefined ? undefined : SUIKA_FRUIT_NAME_KEYS[stats.biggestTier];
      if (fruit) rows.push({ labelKey: 'game.suikaGame.biggestTier', value: t(fruit) });
      if (stats.merges !== undefined) rows.push({ labelKey: 'game.suikaGame.merges', value: t('game.suikaGame.mergesValue', stats.merges) });
      if (stats.watermelons) rows.push({ labelKey: 'game.suikaGame.watermelons', value: t('game.suikaGame.watermelonsValue', stats.watermelons) });
      return rows;
    },
    revives: true,
    pauses: true,
    keyboard: false,
    sound: true,
    // CONTRACT(skkuverse-mini): skkuverse-mini/games/suika-game/src/layout.ts holds the same BACKGROUND.
    background: '#CC8C52',
    scrim: 'rgba(0,0,0,0.4)',
  },
  'building-stack': {
    titleKey: 'game.buildingStack.title',
    homeEmoji: '\u{1F3D7}\u{FE0F}',
    // CONTRACT(skkuverse-mini): skkuverse-mini/games/building-stack/src/game/sim.ts names the same Loss values.
    headline: ({ hit }) => (hit === 'toppled' ? 'game.buildingStack.hit.toppled' : 'game.buildingStack.hit.missed'),
    // WHY: buildings left standing when the last heart goes.
    score: { order: 'desc', format: (n) => n.toLocaleString(), unitKey: 'game.buildingUnit' },
    leaderboard: null,
    // CONTRACT(skkuverse-mini): skkuverse-mini/games/building-stack/src/main.ts sends these stats in game.over.
    details: (stats, t) => {
      const rows: ResultDetail[] = [];
      if (stats.perfects !== undefined) rows.push({ labelKey: 'game.buildingStack.perfects', value: t('game.buildingStack.perfectsValue', stats.perfects) });
      if (stats.bestCombo !== undefined) rows.push({ labelKey: 'game.buildingStack.bestCombo', value: t('game.buildingStack.bestComboValue', stats.bestCombo) });
      if (stats.stage !== undefined) rows.push({ labelKey: 'game.buildingStack.stage', value: t('game.buildingStack.stageValue', stats.stage) });
      const campus = stats.campus === undefined ? undefined : BUILDING_STACK_CAMPUS_KEYS[stats.campus];
      if (campus) rows.push({ labelKey: 'game.buildingStack.campus', value: t(campus) });
      return rows;
    },
    revives: false,
    pauses: true,
    keyboard: false,
    sound: true,
    // CONTRACT(skkuverse-mini): skkuverse-mini/games/building-stack/src/layout.ts holds the same BACKGROUND.
    background: '#9FD6FF',
    scrim: 'rgba(0,0,0,0.4)',
  },
  'bigger-building': {
    titleKey: 'game.biggerBuilding.title',
    homeEmoji: '\u{1F3D9}\u{FE0F}',
    // CONTRACT(skkuverse-mini): skkuverse-mini/games/bigger-building/src/game/run.ts names the same RunEnd values.
    headline: ({ hit }) => (hit === 'conquered' ? 'game.biggerBuilding.hit.conquered' : 'game.biggerBuilding.hit.wrong'),
    // WHY: right answers in a row; a conquered pool scores its total less one.
    score: { order: 'desc', format: (n) => n.toLocaleString(), unitKey: 'game.correctUnit' },
    leaderboard: null,
    // CONTRACT(skkuverse-mini): skkuverse-mini/games/bigger-building/src/main.ts sends these stats in game.over.
    details: (stats, t) => {
      const rows: ResultDetail[] = [];
      const campus = stats.campus === undefined ? undefined : BIGGER_BUILDING_CAMPUS_KEYS[stats.campus];
      if (campus) rows.push({ labelKey: 'game.biggerBuilding.campus', value: t(campus) });
      if (stats.total !== undefined) rows.push({ labelKey: 'game.biggerBuilding.total', value: t('game.biggerBuilding.totalValue', stats.total) });
      return rows;
    },
    revives: false,
    pauses: true,
    keyboard: false,
    sound: true,
    // CONTRACT(skkuverse-mini): skkuverse-mini/games/bigger-building/src/layout.ts holds the same BACKGROUND.
    background: '#000000',
    scrim: 'rgba(0,0,0,0.4)',
  },
} satisfies Record<string, FirstPartyGame>;

export type GameId = keyof typeof CONFIG;

export const FIRST_PARTY_GAMES: Readonly<Record<GameId, FirstPartyGame>> = CONFIG;

export function scoreText(game: FirstPartyGame, score: number, t: (key: TranslationKey) => string): string {
  const { format, unitKey } = game.score;
  return unitKey ? `${format(score)}${t(unitKey)}` : format(score);
}
