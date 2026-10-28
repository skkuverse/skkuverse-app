/**
 * The chips the app adds in front of the served ones: 길찾기 to the other
 * campus while directions are on (development and beta), and 학식, which ships
 * wherever the meals screen does.
 */
import { describe, expect, it } from 'vitest';
import { appChips, withAppChips } from './app-chips.rules';
import { chipsFor } from './chips.rules';
import type { MapChip } from './map-config.types';
import live from './__fixtures__/map-config-tabs-live.json';

const SERVED: MapChip[] = live.data.chips.map((c) => ({
  id: c.id,
  label: c.id,
  icon: null,
  action: { kind: 'link', actionType: 'route', actionValue: '/x' },
  isReset: false,
  list: null,
}));

const ON = { lang: 'ko', campus: 'hssc', directionsEnabled: true } as const;

describe('appChips', () => {
  it('puts 길찾기 first, then 학식, then every served chip', () => {
    const ids = withAppChips(SERVED, appChips(ON)).map((c) => c.id);
    expect(ids).toEqual(['app.directions', 'app.meals', ...SERVED.map((c) => c.id)]);
  });

  it('leads with 학식 when directions are off, and offers no 길찾기', () => {
    const ids = withAppChips(SERVED, appChips({ ...ON, directionsEnabled: false })).map((c) => c.id);
    expect(ids).toEqual(['app.meals', ...SERVED.map((c) => c.id)]);
  });

  it('names the other campus, and opens the selected campus’s route', () => {
    const fromHssc = appChips(ON)[0];
    const fromNsc = appChips({ ...ON, campus: 'nsc' })[0];
    expect([fromHssc?.icon, fromHssc?.label, fromHssc?.action]).toEqual([
      { kind: 'emoji', emoji: '\u{1F68C}' },
      '자과캠 가기',
      { kind: 'link', actionType: 'route', actionValue: '/routes/hssc-to-nsc' },
    ]);
    expect([fromNsc?.label, fromNsc?.action]).toEqual([
      '인사캠 가기',
      { kind: 'link', actionType: 'route', actionValue: '/routes/nsc-to-hssc' },
    ]);
  });

  it('opens the meals screen as the home tile does, whether directions are on or off', () => {
    for (const directionsEnabled of [true, false]) {
      const meals = appChips({ ...ON, directionsEnabled }).find((c) => c.id === 'app.meals');
      expect([meals?.icon, meals?.label, meals?.action]).toEqual([
        { kind: 'emoji', emoji: '\u{1F35A}' },
        '학식',
        { kind: 'link', actionType: 'route', actionValue: '/meals' },
      ]);
    }
  });

  it('shows both on the map and transit rows, and on the native shell’s one row', () => {
    const row = withAppChips(SERVED, appChips(ON));
    for (const tab of ['map', 'transit'] as const) {
      expect(chipsFor('byTab', tab, row).slice(0, 2).map((c) => c.id)).toEqual(['app.directions', 'app.meals']);
    }
    expect(chipsFor('all', 'map', row).slice(0, 2).map((c) => c.id)).toEqual(['app.directions', 'app.meals']);
  });

  it('never shares an id with a served chip', () => {
    const served = new Set(SERVED.map((c) => c.id));
    for (const chip of appChips(ON)) expect(served.has(chip.id)).toBe(false);
  });
});
