/**
 * The in-house promo's pure decisions: the session's weighted pick, which
 * creative may show given what the games registry opens and which games
 * revive, the events' params, and when the card counts as seen.
 */
import { describe, expect, it } from 'vitest';
import { REVIVING_GAME_IDS } from '@/features/games/games.constants';
import { PROMO_CREATIVES } from './promo.constants';
import {
  decidePromoCreative,
  decidePromoImpression,
  isPromoLanguage,
  isPromoSeen,
  pickWeighted,
  toPromoEntrySource,
  toPromoLink,
  toPromoParams,
  toVisibleShare,
} from './promo.rules';
import type { PromoCreative } from './promo.types';

const creative = (fields: Partial<PromoCreative> = {}): PromoCreative => ({
  id: 'wave-run',
  emoji: '\u{1F3C4}',
  titleKey: 'promo.waveRun.title',
  subtitleKey: 'promo.waveRun.subtitle',
  weight: 80,
  target: 'wave-run',
  ...fields,
});

const WAVE = creative();
const SUIKA = creative({ id: 'suika-game', emoji: '\u{1F349}', weight: 20, target: 'suika-game' });
const BOTH = ['wave-run', 'suika-game'] as const;

describe('pickWeighted', () => {
  it.each<[string, number, string | null]>([
    ['the lowest roll', 0, 'a'],
    ['a roll inside the first share', 0.79, 'a'],
    ['the first roll past the first share', 0.8, 'b'],
    ['the highest roll', 0.999_999, 'b'],
  ])('%s', (_, roll, expected) => {
    // Arrange
    const items = [
      { id: 'a', weight: 80 },
      { id: 'b', weight: 20 },
    ];

    // Act
    const picked = pickWeighted(items, roll);

    // Assert
    expect(picked?.id ?? null).toBe(expected);
  });

  it('splits evenly spread rolls by weight', () => {
    // Arrange
    const items = [
      { id: 'a', weight: 80 },
      { id: 'b', weight: 20 },
    ];
    const rolls = Array.from({ length: 1000 }, (_, i) => i / 1000);

    // Act
    const picks = rolls.map((roll) => pickWeighted(items, roll)?.id);

    // Assert
    expect(picks.filter((id) => id === 'a')).toHaveLength(800);
    expect(picks.filter((id) => id === 'b')).toHaveLength(200);
  });

  it.each<[string, { id: string; weight: number }[], number, string | null]>([
    ['nothing to pick from', [], 0.5, null],
    ['only zero weights', [{ id: 'a', weight: 0 }], 0.5, null],
    ['a zero weight never picked', [{ id: 'a', weight: 0 }, { id: 'b', weight: 1 }], 0, 'b'],
    ['a negative weight never picked', [{ id: 'a', weight: -5 }, { id: 'b', weight: 1 }], 0, 'b'],
    ['a roll out of range clamped high', [{ id: 'a', weight: 1 }, { id: 'b', weight: 1 }], 1, 'b'],
    ['a roll out of range clamped low', [{ id: 'a', weight: 1 }, { id: 'b', weight: 1 }], -1, 'a'],
  ])('%s', (_, items, roll, expected) => {
    // Act
    const picked = pickWeighted(items, roll);

    // Assert
    expect(picked?.id ?? null).toBe(expected);
  });
});

describe('decidePromoCreative', () => {
  it.each<[string, readonly string[], readonly string[], number, PromoCreative | null]>([
    ['both open, a low roll', BOTH, BOTH, 0.1, WAVE],
    ['both open, a high roll', BOTH, BOTH, 0.9, SUIKA],
    ['wave-run not open falls back to suika at any roll', ['suika-game'], BOTH, 0.1, SUIKA],
    ['suika not open falls back to wave-run at any roll', ['wave-run'], BOTH, 0.9, WAVE],
    ['neither open shows nothing', [], BOTH, 0.1, null],
    ['the registry not answered shows nothing', [], BOTH, 0.9, null],
    ['an open game that does not revive is never shown', BOTH, ['suika-game'], 0.1, SUIKA],
    ['no reviving game shows nothing', BOTH, [], 0.1, null],
  ])('%s', (_, openable, reviving, roll, expected) => {
    // Act
    const decided = decidePromoCreative([WAVE, SUIKA], { openable, reviving, roll });

    // Assert
    expect(decided).toStrictEqual(expected);
  });
});

describe('PROMO_CREATIVES', () => {
  it('targets only games whose run offers the rewarded revive', () => {
    // Act
    const targets = PROMO_CREATIVES.map((c) => c.target);

    // Assert
    expect(targets.every((id) => REVIVING_GAME_IDS.includes(id))).toBe(true);
  });

  it('gives wave-run four fifths of the sessions and suika the rest', () => {
    // Arrange
    const total = PROMO_CREATIVES.reduce((sum, c) => sum + c.weight, 0);

    // Act
    const shares = Object.fromEntries(PROMO_CREATIVES.map((c) => [c.id, c.weight / total]));

    // Assert
    expect(shares).toStrictEqual({ 'wave-run': 0.8, 'suika-game': 0.2 });
  });
});

describe('isPromoLanguage', () => {
  it.each([
    ['ko', true],
    ['en', false],
    ['zh', false],
  ] as const)('%s', (lang, expected) => {
    // Act & Assert
    expect(isPromoLanguage(lang)).toBe(expected);
  });
});

describe('toPromoParams', () => {
  it.each<[string, Parameters<typeof toPromoParams>, ReturnType<typeof toPromoParams>]>([
    [
      'the transit card names its slot, its creative and the game',
      ['transit_top', SUIKA],
      { slot: 'transit_top', creative_id: 'suika-game', target: 'suika-game' },
    ],
    [
      'a mini-app page tile names its slot and the game as its creative',
      ['miniapp_games', { id: 'building-stack', target: 'building-stack' }],
      { slot: 'miniapp_games', creative_id: 'building-stack', target: 'building-stack' },
    ],
  ])('%s', (_, args, expected) => {
    // Act
    const params = toPromoParams(...args);

    // Assert
    expect(params).toStrictEqual(expected);
  });
});

describe('toPromoEntrySource', () => {
  it.each([
    ['transit_top', 'promo:transit_top'],
    ['miniapp_games', 'promo:miniapp_games'],
  ] as const)('carries %s into the game screen as its source', (slot, expected) => {
    // Act & Assert
    expect(toPromoEntrySource(slot)).toBe(expected);
  });
});

describe('decidePromoImpression', () => {
  it.each<[string, Parameters<typeof decidePromoImpression>[0], ReturnType<typeof decidePromoImpression>]>([
    ['seen in a tab visit with none sent yet', { visit: 3, sentInVisit: undefined, seen: true, covered: false }, 'send'],
    ['seen again in a visit that already sent one', { visit: 3, sentInVisit: 3, seen: true, covered: false }, 'done'],
    ['not seen yet in a visit that already sent one', { visit: 3, sentInVisit: 3, seen: false, covered: false }, 'done'],
    ['seen in a new visit after one sent in an earlier visit', { visit: 4, sentInVisit: 3, seen: true, covered: false }, 'send'],
    ['not seen, off screen or below a collapsed sheet', { visit: 3, sentInVisit: undefined, seen: false, covered: false }, 'wait'],
    ['seen under the launch splash', { visit: 3, sentInVisit: undefined, seen: true, covered: true }, 'wait'],
    ['seen before any tab was focused', { visit: 0, sentInVisit: undefined, seen: true, covered: false }, 'wait'],
  ])('%s', (_, inputs, expected) => {
    // Act & Assert
    expect(decidePromoImpression(inputs)).toBe(expected);
  });
});

describe('toPromoLink', () => {
  it('names the game and carries the slot as how the link arrived', () => {
    // Act
    const link = toPromoLink('transit_top', SUIKA);

    // Assert
    expect(link).toStrictEqual({ id: 'suika-game', via: 'promo:transit_top' });
  });
});

describe('toVisibleShare and isPromoSeen', () => {
  it.each<[string, { top: number; bottom: number }, { top: number; bottom: number }, number, boolean]>([
    ['wholly inside the viewport', { top: 100, bottom: 180 }, { top: 50, bottom: 800 }, 1, true],
    ['exactly half under the bottom edge', { top: 760, bottom: 840 }, { top: 50, bottom: 800 }, 0.5, true],
    ['less than half under the bottom edge', { top: 761, bottom: 841 }, { top: 50, bottom: 800 }, 39 / 80, false],
    ['scrolled half under the top edge', { top: 10, bottom: 90 }, { top: 50, bottom: 800 }, 0.5, true],
    ['scrolled out above', { top: -200, bottom: -120 }, { top: 50, bottom: 800 }, 0, false],
    ['below a sheet pulled down', { top: 900, bottom: 980 }, { top: 850, bottom: 800 }, 0, false],
    ['not laid out yet', { top: 0, bottom: 0 }, { top: 0, bottom: 800 }, 0, false],
  ])('%s', (_, card, viewport, share, seen) => {
    // Act
    const visible = toVisibleShare(card, viewport);

    // Assert
    expect(visible).toBeCloseTo(share);
    expect(isPromoSeen(card, viewport)).toBe(seen);
  });
});
