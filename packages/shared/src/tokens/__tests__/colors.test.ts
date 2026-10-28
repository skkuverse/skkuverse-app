import { describe, it, expect } from 'vitest';
import { SdsColors, SdsPalette, resolveSdsColors, type AdaptiveColor, type SdsColorName } from '../colors';
import { contrast, luminance } from './contrast';

const OPAQUE = /^#[0-9A-F]{6}$/;
const WITH_ALPHA = /^#[0-9A-F]{8}$/;
const STEPS = ['100', '200', '300', '400', '500', '600', '700', '800', '900', '1000'];

const { static: staticColors, ...hues } = SdsPalette;

/** Each hue's steps, nearest the background first. */
function stepsOf(hue: string): string[] {
  return hue === 'grey' ? ['00', ...STEPS] : STEPS;
}

function stepOf(hue: string, step: string): AdaptiveColor {
  return (hues as Record<string, Record<string, AdaptiveColor>>)[hue][step];
}

describe('SdsPalette', () => {
  it('gives every hue all ten steps, and grey its 00 as well', () => {
    for (const hue of Object.keys(hues)) {
      expect(Object.keys(hues[hue as keyof typeof hues]).sort(), hue).toEqual([...stepsOf(hue)].sort());
    }
  });

  it('holds an opaque #RRGGBB for both modes at every step', () => {
    for (const hue of Object.keys(hues)) {
      for (const step of stepsOf(hue)) {
        const color = stepOf(hue, step);
        expect(Object.keys(color).sort(), `${hue}.${step}`).toEqual(['dark', 'light']);
        expect(color.light, `${hue}.${step}.light`).toMatch(OPAQUE);
        expect(color.dark, `${hue}.${step}.dark`).toMatch(OPAQUE);
      }
    }
  });

  it('writes static colors as hex, with alpha as #RRGGBBAA', () => {
    for (const [name, value] of Object.entries(staticColors)) {
      expect(OPAQUE.test(value) || WITH_ALPHA.test(value), name).toBe(true);
    }
  });

  // A step is the distance from the background, so it grows in both modes:
  // darker in light, lighter in dark.
  it('moves every step further from the background than the one before', () => {
    for (const hue of Object.keys(hues)) {
      const steps = stepsOf(hue);
      for (let i = 1; i < steps.length; i++) {
        const [nearer, further] = [stepOf(hue, steps[i - 1]), stepOf(hue, steps[i])];
        expect(luminance(further.light), `${hue}.${steps[i]} light`).toBeLessThan(luminance(nearer.light));
        expect(luminance(further.dark), `${hue}.${steps[i]} dark`).toBeGreaterThan(luminance(nearer.dark));
      }
    }
  });

  // The deep brand greens (900, 1000) are near-invisible on a dark
  // background as-is; their dark values must not be. Grey climbs on its own
  // ladder, so this holds the chromatic hues only.
  it('keeps the strong chromatic steps readable on the dark background', () => {
    const background = SdsPalette.grey[100].dark;
    for (const hue of Object.keys(hues).filter((name) => name !== 'grey')) {
      for (const step of ['500', '600', '700', '800', '900', '1000']) {
        expect(contrast(stepOf(hue, step).dark, background), `${hue}.${step}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

// The step every TDS name points at. Changing one changes a color across the
// app, so it should be a deliberate edit here too.
const EXPECTED: Record<SdsColorName, AdaptiveColor> = {
  grey50: SdsPalette.grey[100],
  grey100: SdsPalette.grey[200],
  grey200: SdsPalette.grey[300],
  grey300: SdsPalette.grey[400],
  grey400: SdsPalette.grey[500],
  grey500: SdsPalette.grey[600],
  grey600: SdsPalette.grey[700],
  grey700: SdsPalette.grey[800],
  grey800: SdsPalette.grey[900],
  grey900: SdsPalette.grey[1000],
  greyOpacity50: { light: SdsPalette.static.greyOpacity50, dark: SdsPalette.static.greyOpacity50 },
  greyOpacity200: { light: SdsPalette.static.greyOpacity200, dark: SdsPalette.static.greyOpacity200 },
  greyOpacity500: { light: SdsPalette.static.greyOpacity500, dark: SdsPalette.static.greyOpacity500 },
  greyOpacity800: { light: SdsPalette.static.greyOpacity800, dark: SdsPalette.static.greyOpacity800 },
  greyOpacity900: { light: SdsPalette.static.greyOpacity900, dark: SdsPalette.static.greyOpacity900 },
  blue50: SdsPalette.blue[100],
  blue200: SdsPalette.blue[500],
  blue400: SdsPalette.blue[600],
  blue500: SdsPalette.blue[700],
  blue600: SdsPalette.blue[800],
  blue700: SdsPalette.blue[900],
  red50: SdsPalette.red[100],
  red500: SdsPalette.red[700],
  green50: SdsPalette.green[100],
  green500: SdsPalette.green[600],
  orange50: SdsPalette.orange[100],
  orange500: SdsPalette.orange[500],
  yellow50: SdsPalette.yellow[100],
  yellow400: SdsPalette.yellow[300],
  yellow500: SdsPalette.yellow[400],
  yellow800: SdsPalette.yellow[500],
  yellow900: SdsPalette.yellow[600],
  teal50: SdsPalette.teal[100],
  teal500: SdsPalette.teal[600],
  purple500: SdsPalette.purple[800],
  highlight: SdsPalette.yellow[200],
  scrim: { light: SdsPalette.static.scrim, dark: SdsPalette.static.scrim },
  scrimGlass: { light: SdsPalette.static.scrimGlass, dark: SdsPalette.static.scrimGlass },
  background: { light: SdsPalette.grey['00'].light, dark: SdsPalette.grey[100].dark },
  greyBackground: SdsPalette.grey[200],
  layeredBackground: { light: SdsPalette.grey['00'].light, dark: SdsPalette.grey[200].dark },
  floatedBackground: { light: SdsPalette.grey['00'].light, dark: SdsPalette.grey[300].dark },
  brand: SdsPalette.pine[700],
  brandLight: SdsPalette.pine[100],
  brandDark: SdsPalette.pine[1000],
};

describe('SdsColors', () => {
  it('keeps every TDS name', () => {
    expect(Object.keys(SdsColors).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it('reads each name from its palette step in light', () => {
    for (const [name, step] of Object.entries(EXPECTED)) {
      expect(SdsColors[name as SdsColorName], name).toBe(step.light);
    }
  });

  it('reads the same steps in dark', () => {
    const dark = resolveSdsColors('dark');
    for (const [name, step] of Object.entries(EXPECTED)) {
      expect(dark[name as SdsColorName], name).toBe(step.dark);
    }
  });

  it('is the light resolution', () => {
    expect(resolveSdsColors('light')).toEqual(SdsColors);
  });
});
