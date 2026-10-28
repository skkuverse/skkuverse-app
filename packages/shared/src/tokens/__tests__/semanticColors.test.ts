import { describe, it, expect } from 'vitest';
import { SdsColors, SdsPalette, type AdaptiveColor, type ColorMode } from '../colors';
import {
  SdsSemanticColors,
  resolveSemanticColors,
  semanticColorSteps,
  type BgColorName,
  type FgColorName,
  type SemanticColors,
} from '../semanticColors';
import { contrast, luminance, over } from './contrast';

const MODES: ColorMode[] = ['light', 'dark'];
const HEX = /^#[0-9A-F]{6}([0-9A-F]{2})?$/;

const groups = Object.entries(semanticColorSteps) as [keyof SemanticColors, Record<string, AdaptiveColor>][];

/** Every value the palette holds in one mode, static colors included. */
function paletteValues(mode: ColorMode): Set<string> {
  const { static: staticColors, ...hues } = SdsPalette;
  const values = new Set<string>(Object.values(staticColors));
  for (const scale of Object.values(hues)) {
    for (const color of Object.values(scale as Record<string, AdaptiveColor>)) values.add(color[mode]);
  }
  return values;
}

describe('semanticColorSteps', () => {
  it('gives every token a light and a dark value', () => {
    for (const [group, tokens] of groups) {
      for (const [name, color] of Object.entries(tokens)) {
        expect(Object.keys(color).sort(), `${group}.${name}`).toEqual(['dark', 'light']);
        for (const mode of MODES) expect(color[mode], `${group}.${name}.${mode}`).toMatch(HEX);
      }
    }
  });

  // A role names a palette step; a hex of its own would be a value the
  // palette cannot re-tint.
  it('takes every value from the palette', () => {
    for (const mode of MODES) {
      const palette = paletteValues(mode);
      for (const [group, tokens] of groups) {
        for (const [name, color] of Object.entries(tokens)) {
          expect(palette.has(color[mode]), `${group}.${name}.${mode} ${color[mode]}`).toBe(true);
        }
      }
    }
  });
});

describe('resolveSemanticColors', () => {
  it('reads each token in the mode asked for', () => {
    for (const mode of MODES) {
      const resolved = resolveSemanticColors(mode);
      for (const [group, tokens] of groups) {
        expect(Object.keys(resolved[group]).sort(), group).toEqual(Object.keys(tokens).sort());
        for (const [name, color] of Object.entries(tokens)) {
          expect((resolved[group] as Record<string, string>)[name], `${group}.${name}`).toBe(color[mode]);
        }
      }
    }
  });

  it('is what SdsSemanticColors holds', () => {
    for (const mode of MODES) expect(SdsSemanticColors[mode]).toEqual(resolveSemanticColors(mode));
  });
});

// The brand's nine roles, and the step each names. Moving one is a decision
// (ADR 0011), so it should be a deliberate edit here too.
describe('brand roles', () => {
  const brand: [string, AdaptiveColor, AdaptiveColor][] = [
    ['bg.brandSolid', semanticColorSteps.bg.brandSolid, { light: SdsPalette.pine[900].light, dark: SdsPalette.pine[500].dark }],
    ['bg.brandSolidPressed', semanticColorSteps.bg.brandSolidPressed, { light: SdsPalette.pine[1000].light, dark: SdsPalette.pine[600].dark }],
    ['bg.brandWeak', semanticColorSteps.bg.brandWeak, { light: SdsPalette.pine[100].light, dark: SdsPalette.pine[200].dark }],
    ['bg.brandWeakPressed', semanticColorSteps.bg.brandWeakPressed, { light: SdsPalette.pine[200].light, dark: SdsPalette.pine[300].dark }],
    ['fg.brand', semanticColorSteps.fg.brand, { light: SdsPalette.pine[800].light, dark: SdsPalette.pine[700].dark }],
    ['fg.brandContrast', semanticColorSteps.fg.brandContrast, SdsPalette.pine[900]],
    ['fg.onBrandSolid', semanticColorSteps.fg.onBrandSolid, { light: SdsPalette.static.white, dark: SdsPalette.static.white }],
    ['stroke.brandSolid', semanticColorSteps.stroke.brandSolid, SdsPalette.pine[900]],
    ['stroke.brandWeak', semanticColorSteps.stroke.brandWeak, SdsPalette.pine[300]],
  ];

  it('names its pine steps', () => {
    for (const [name, actual, expected] of brand) expect(actual, name).toEqual(expected);
  });

  // The default for a route or map color the data leaves empty: the brand's
  // own green (pine 700) in each mode, the green the maps have always drawn.
  it('defaults a data color to the brand green', () => {
    expect(semanticColorSteps.bg.dataBrand).toEqual(SdsPalette.pine[700]);
    expect(SdsSemanticColors.light.bg.dataBrand).toBe(SdsColors.brand);
  });

  // The CTA keeps the deep green it has always filled with, and the brand
  // stays text-legible on white, where the old `brand` green (pine 700) fell
  // just short.
  it('fills the CTA with the deep green, and reads as text on white', () => {
    expect(SdsSemanticColors.light.bg.brandSolid).toBe('#1F3D2E');
    expect(contrast(SdsPalette.pine[700].light, SdsPalette.static.white)).toBeLessThan(4.5);
    expect(contrast(SdsSemanticColors.light.fg.brand, SdsPalette.static.white)).toBeGreaterThanOrEqual(4.5);
  });
});

// The light values the TDS names already draw, where a role takes over from
// one: SDS Button reads these roles, and its light rendering must not move.
describe('light parity with SdsColors', () => {
  const light = SdsSemanticColors.light;
  const pairs: [string, string, string][] = [
    ['fg.neutral', light.fg.neutral, SdsColors.grey900],
    ['fg.neutralMuted', light.fg.neutralMuted, SdsColors.grey700],
    ['fg.neutralSubtle', light.fg.neutralSubtle, SdsColors.grey600],
    ['fg.onBrandSolid', light.fg.onBrandSolid, SdsColors.background],
    ['fg.onNeutralSolid', light.fg.onNeutralSolid, SdsColors.background],
    ['fg.critical', light.fg.critical, SdsColors.red500],
    ['bg.layerDefault', light.bg.layerDefault, SdsColors.background],
    ['bg.neutralSolid', light.bg.neutralSolid, SdsColors.grey700],
    ['bg.neutralWeak', light.bg.neutralWeak, SdsColors.grey100],
    ['bg.criticalSolid', light.bg.criticalSolid, SdsColors.red500],
    ['bg.overlay', light.bg.overlay, SdsColors.scrim],
  ];

  // The values the SDS components drew as literals before these roles
  // existed (sds-6): moving them onto roles must not move a pixel in light.
  const drawn: [string, string, string][] = [
    ['bg.toast', light.bg.toast, '#212121EB'], // rgba(33, 33, 33, 0.92)
    ['fg.onToast', light.fg.onToast, SdsPalette.static.white],
    ['fg.onToastAction', light.fg.onToastAction, SdsColors.blue200],
    ['fg.onToastPositive', light.fg.onToastPositive, SdsColors.green500],
    ['fg.onToastWarning', light.fg.onToastWarning, '#FFA726'],
    ['stroke.control', light.stroke.control, '#B0B8C1'],
    ['fg.neutralFaint', light.fg.neutralFaint, SdsColors.grey300],
    ['bg.neutralInverted', light.bg.neutralInverted, SdsColors.grey900],
    ['fg.neutralInverted', light.fg.neutralInverted, SdsPalette.static.white],
    ['bg.glassTint', light.bg.glassTint, '#FFFFFFB8'], // rgba(255, 255, 255, 0.72)
  ];

  it('keeps the light value each component drew before its role', () => {
    for (const [name, role, drew] of drawn) expect(role, name).toBe(drew);
  });

  it('matches the TDS name each role replaces', () => {
    for (const [name, role, tds] of pairs) expect(role, name).toBe(tds);
  });
});

describe('state and elevation', () => {
  const roles = ['brand', 'critical', 'informative', 'positive', 'warning'] as const;

  // A press moves a color role one step away from the background: darker in
  // light, lighter in dark.
  it('moves a pressed color fill away from the background in both modes', () => {
    for (const role of roles) {
      for (const variant of ['Solid', 'Weak'] as const) {
        const rest = semanticColorSteps.bg[`${role}${variant}` as BgColorName];
        const pressed = semanticColorSteps.bg[`${role}${variant}Pressed` as BgColorName];
        expect(luminance(pressed.light), `${role}${variant} light`).toBeLessThan(luminance(rest.light));
        expect(luminance(pressed.dark), `${role}${variant} dark`).toBeGreaterThan(luminance(rest.dark));
      }
    }
  });

  it('moves the pressed AI fill away from the background in both modes', () => {
    const { aiWeak, aiWeakPressed } = semanticColorSteps.bg;
    expect(luminance(aiWeakPressed.light)).toBeLessThan(luminance(aiWeak.light));
    expect(luminance(aiWeakPressed.dark)).toBeGreaterThan(luminance(aiWeak.dark));
  });

  // Neutral solid is the far end of the scale already, so its press comes
  // back toward the background, as SEED's does.
  it('moves the pressed neutral solid toward the background', () => {
    const { neutralSolid, neutralSolidPressed } = semanticColorSteps.bg;
    expect(luminance(neutralSolidPressed.light)).toBeGreaterThan(luminance(neutralSolid.light));
    expect(luminance(neutralSolidPressed.dark)).toBeLessThan(luminance(neutralSolid.dark));
  });

  // The neutral surfaces a control can sit on press away from the background
  // as the color fills do; the inverted fill, at the far end, comes back.
  it('moves the pressed neutral surfaces like the color fills', () => {
    for (const role of ['layerBasement', 'neutralMuted'] as const) {
      const rest = semanticColorSteps.bg[role];
      const pressed = semanticColorSteps.bg[`${role}Pressed`];
      expect(luminance(pressed.light), `${role} light`).toBeLessThan(luminance(rest.light));
      expect(luminance(pressed.dark), `${role} dark`).toBeGreaterThan(luminance(rest.dark));
    }
    const { neutralInverted, neutralInvertedPressed } = semanticColorSteps.bg;
    expect(luminance(neutralInvertedPressed.light)).toBeGreaterThan(luminance(neutralInverted.light));
    expect(luminance(neutralInvertedPressed.dark)).toBeLessThan(luminance(neutralInverted.dark));
  });

  // The overlay is a dim in both modes, so its press dims further.
  it('darkens the pressed overlay over any layer', () => {
    for (const mode of MODES) {
      const { bg } = SdsSemanticColors[mode];
      expect(luminance(over(bg.overlayPressed, bg.layerDefault)), mode).toBeLessThan(luminance(over(bg.overlay, bg.layerDefault)));
    }
  });

  it('lightens the layers as they rise in dark', () => {
    const { layerBasement, layerDefault, layerFloating } = SdsSemanticColors.dark.bg;
    expect(luminance(layerDefault)).toBeGreaterThan(luminance(layerBasement));
    expect(luminance(layerFloating)).toBeGreaterThan(luminance(layerDefault));
  });
});

// ── Contrast ──
//
// WCAG 2.x (see ./contrast.ts), every pair in both modes. The pairs are the
// ones the roles are for: text on the layers it sits on, the `on*Solid`
// foregrounds on their fills, and the `-contrast` text on its weak fill.
//
// Left out on purpose:
// - `fg.disabled`: WCAG sets no minimum for a disabled control.
// - `fg.placeholder`: held to whichever standard is chosen, since WCAG 2.x
//   and APCA disagree most on it.
// - Pressed fills: a press lasts as long as the tap, and WCAG measures the
//   resting state.
// - `fg.neutralSubtle` on the basement: meta text sits on a default or
//   floating surface, not on the ground under it.
const TEXT = 4.5; // body text
const LARGE = 3; // large or bold text, icons and other non-text marks

const SURFACES: BgColorName[] = ['layerDefault', 'layerFloating'];

const PAIRS: [FgColorName, BgColorName[], number][] = [
  ['neutral', [...SURFACES, 'layerBasement', 'neutralWeak', 'neutralMuted'], TEXT],
  ['neutralMuted', [...SURFACES, 'layerBasement', 'neutralWeak', 'neutralMuted'], TEXT],
  ['neutralSubtle', SURFACES, TEXT],
  ['onNeutralSolid', ['neutralSolid'], TEXT],

  // The brand is held to body text everywhere it sits, the CTA included.
  ['brand', [...SURFACES, 'layerBasement', 'neutralWeak', 'brandWeak'], TEXT],
  ['brandContrast', [...SURFACES, 'layerBasement', 'neutralWeak', 'brandWeak', 'brandWeakPressed'], TEXT],
  ['onBrandSolid', ['brandSolid'], TEXT],

  // The AI label sits on its weak fill and on the plain surfaces at body size.
  ['ai', [...SURFACES, 'aiWeak'], TEXT],

  // A status color at SEED's step (700) is 3.7–4.1:1 on white under WCAG
  // 2.x: icons and large or bold text. Body-size text takes `-contrast`.
  ['critical', SURFACES, LARGE],
  ['criticalContrast', [...SURFACES, 'criticalWeak'], TEXT],
  ['onCriticalSolid', ['criticalSolid'], LARGE],
  ['informative', SURFACES, LARGE],
  ['informativeContrast', [...SURFACES, 'informativeWeak'], TEXT],
  ['onInformativeSolid', ['informativeSolid'], LARGE],
  ['positive', SURFACES, LARGE],
  ['positiveContrast', [...SURFACES, 'positiveWeak'], TEXT],
  ['onPositiveSolid', ['positiveSolid'], LARGE],
  ['warning', SURFACES, LARGE],
  ['warningContrast', [...SURFACES, 'warningWeak'], TEXT],
  ['onWarningSolid', ['warningSolid'], TEXT],
];

describe('contrast (WCAG 2.x)', () => {
  for (const mode of MODES) {
    it(`holds every pair in ${mode}`, () => {
      const { fg, bg } = SdsSemanticColors[mode];
      for (const [foreground, backgrounds, minimum] of PAIRS) {
        for (const background of backgrounds) {
          const ratio = contrast(fg[foreground], bg[background]);
          expect(ratio, `fg.${foreground} on bg.${background}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(minimum);
        }
      }
    });
  }

  // The dark CTA's pressed fill is a lighter green under the same white
  // label. Not a resting pair, but it must not drop below a large label's
  // minimum while the finger is down.
  it('keeps the CTA label readable while pressed', () => {
    for (const mode of MODES) {
      const { fg, bg } = SdsSemanticColors[mode];
      expect(contrast(fg.onBrandSolid, bg.brandSolidPressed), mode).toBeGreaterThanOrEqual(LARGE);
    }
  });
});

// ── The component surfaces' own pairs ──
//
// The toast is translucent and the same dark surface in both modes, so its
// foregrounds are measured on it composited over the layer it floats on.
// The glass tint is the veil under a glass card's text, measured the same way.
describe('component surfaces (WCAG 2.x)', () => {
  for (const mode of MODES) {
    const { fg, bg, stroke } = SdsSemanticColors[mode];
    const toast = over(bg.toast, bg.layerDefault);

    it(`holds the toast's label, action and icons in ${mode}`, () => {
      expect(contrast(fg.onToast, toast)).toBeGreaterThanOrEqual(TEXT);
      expect(contrast(fg.onToastAction, toast)).toBeGreaterThanOrEqual(TEXT);
      for (const icon of [fg.onToastPositive, fg.onToastWarning]) expect(contrast(icon, toast)).toBeGreaterThanOrEqual(LARGE);
    });

    it(`holds the inverted label on its fill in ${mode}`, () => {
      expect(contrast(fg.neutralInverted, bg.neutralInverted)).toBeGreaterThanOrEqual(TEXT);
      expect(contrast(fg.neutralInverted, bg.neutralInvertedPressed)).toBeGreaterThanOrEqual(LARGE);
      expect(contrast(fg.neutralInvertedMuted, bg.neutralInverted)).toBeGreaterThanOrEqual(TEXT);
    });

    it(`keeps text readable on the glass tint in ${mode}`, () => {
      expect(contrast(fg.neutral, over(bg.glassTint, bg.layerDefault))).toBeGreaterThanOrEqual(TEXT);
    });

    // An unchecked box must read as a control, a step past the card outline.
    // Its contrast on the layer is below WCAG's 3:1 for controls, the grey it
    // has always drawn; raising it is a design decision, not this mapping's.
    it(`draws the control outline further from the layer than the shape outline in ${mode}`, () => {
      expect(contrast(stroke.control, bg.layerDefault)).toBeGreaterThan(contrast(stroke.neutralWeak, bg.layerDefault));
    });
  }
});
