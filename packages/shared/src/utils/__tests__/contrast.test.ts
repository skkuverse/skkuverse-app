/**
 * `legibleOn` lifts a server's data color (a subway marker, a bus badge) until
 * it reads on the surface it sits on, keeping its hue.
 *
 * The colors are the ones served today: every subway marker color
 * (skkuverse-server `src/subway/subway-registry.json`, `marker.color`) and the
 * transit tab's three bus icon colors (`launch-ko.json` fixture). The ground is
 * the row's actual surface, `bg.layerDefault`, in each mode.
 */
import { describe, expect, it } from 'vitest';
import { SdsSemanticColors } from '../../tokens/semanticColors';
import { contrast, legibleOn, oklabHue, over } from '../contrast';

const DARK = SdsSemanticColors.dark.bg.layerDefault;
const LIGHT = SdsSemanticColors.light.bg.layerDefault;

/** Every subway marker color the server serves, by line. */
const MARKERS = {
  '1': '#0052A4',
  '4': '#007FAB',
  '2': '#00893F',
  '3': '#BB5C0D',
  '8': '#E4186B',
  K1: '#A26B00',
  D1: '#D4003B',
} as const;

/** The bus badge colors: 성대, 마을 and the commute group's 환승. */
const BUS = { shuttle: '#003626', village: '#4CAF50', group: '#8B95A1' } as const;

/** The bus badge's fill behind its text: the badge color at 0x1F (about 12%). */
const BADGE_FILL = 0x1f / 255;

/** `color`'s badge tint over the dark row. */
const tintOnDark = (color: string) => over(`${color}1F`, DARK);

const AA = 4.5;

/** Hue drift allowed: what rounding to 8-bit channels costs, never a turn toward another hue. */
const sameHue = (a: string, b: string) => expect(Math.abs(oklabHue(a) - oklabHue(b))).toBeLessThan(1);

describe('contrast', () => {
  it('measures WCAG 2.x contrast: black on white is 21, a color on itself is 1', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast('#0052A4', '#0052A4')).toBeCloseTo(1, 5);
  });

  it('pins the starting point: every marker reads on white and fails on the dark row', () => {
    for (const color of Object.values(MARKERS)) {
      expect(contrast(color, LIGHT)).toBeGreaterThanOrEqual(AA);
      expect(contrast(color, DARK)).toBeLessThan(AA);
    }
    expect(contrast(MARKERS['1'], DARK)).toBeCloseTo(2.34, 2);
  });
});

describe('oklabHue', () => {
  it("matches Ottosson's reference for sRGB red", () => {
    // OKLab of #FF0000 is (0.628, 0.2249, 0.1258).
    expect(oklabHue('#FF0000')).toBeCloseTo((Math.atan2(0.1258, 0.2249) * 180) / Math.PI, 0);
  });
});

describe('legibleOn', () => {
  it.each(Object.entries(MARKERS))('lifts line %s’s marker to 4.5:1 on the dark row, no further than a step past it', (_, color) => {
    const lifted = legibleOn(color, DARK);

    expect(contrast(lifted, DARK)).toBeGreaterThanOrEqual(AA);
    expect(contrast(lifted, DARK)).toBeLessThan(AA + 0.25);
  });

  it.each(Object.entries(MARKERS))('keeps line %s’s hue while lifting it', (_, color) => {
    sameHue(legibleOn(color, DARK), color);
  });

  it.each(Object.entries(BUS))('lifts the %s badge to 4.5:1 on its own tint over the dark row', (_, color) => {
    const lifted = legibleOn(color, DARK, { fill: BADGE_FILL });

    expect(contrast(lifted, tintOnDark(lifted))).toBeGreaterThanOrEqual(AA);
    sameHue(lifted, color);
  });

  it('lifts 성대 from 1.3:1, and leaves 마을 and 환승, which already read on dark', () => {
    expect(contrast(BUS.shuttle, tintOnDark(BUS.shuttle))).toBeLessThan(1.5);
    expect(legibleOn(BUS.shuttle, DARK, { fill: BADGE_FILL })).not.toBe(BUS.shuttle);
    expect(legibleOn(BUS.village, DARK, { fill: BADGE_FILL })).toBe(BUS.village);
    expect(legibleOn(BUS.group, DARK, { fill: BADGE_FILL })).toBe(BUS.group);
  });

  it('returns a color that already reads unchanged: every marker on the light row', () => {
    for (const color of Object.values(MARKERS)) expect(legibleOn(color, LIGHT)).toBe(color);
  });

  it('takes the server form with no #, and answers #RRGGBB', () => {
    expect(legibleOn('0052A4', DARK)).toMatch(/^#[0-9A-F]{6}$/);
    expect(legibleOn('0052A4', DARK)).toBe(legibleOn('#0052A4', DARK));
  });

  it('darkens on a light ground, so it never has to know the mode', () => {
    const darkened = legibleOn('#F5A200', LIGHT);

    expect(contrast(darkened, LIGHT)).toBeGreaterThanOrEqual(AA);
    sameHue(darkened, '#F5A200');
  });

  it('returns what it cannot read unchanged', () => {
    expect(legibleOn('red', DARK)).toBe('red');
    expect(legibleOn('#0052A4', 'rgba(0,0,0,1)')).toBe('#0052A4');
  });
});
