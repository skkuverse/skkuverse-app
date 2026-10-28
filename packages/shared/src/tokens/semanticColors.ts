// SEE: docs/decisions/0011-adopt-seed-color-token-structure.md
import { SdsPalette, type AdaptiveColor, type ColorMode } from './colors';

const p = SdsPalette;
const s = SdsPalette.static;

function byMode(light: AdaptiveColor, dark: AdaptiveColor): AdaptiveColor {
  return { light: light.light, dark: dark.dark };
}

function fixed(value: string): AdaptiveColor {
  return { light: value, dark: value };
}

interface SemanticShape {
  fg: Readonly<Record<string, AdaptiveColor>>;
  bg: Readonly<Record<string, AdaptiveColor>>;
  stroke: Readonly<Record<string, AdaptiveColor>>;
}

export const semanticColorSteps = {
  fg: {
    neutral: p.grey[1000],
    neutralMuted: p.grey[800],
    neutralSubtle: p.grey[700],
    placeholder: p.grey[600],
    disabled: p.grey[500],
    onNeutralSolid: byMode(p.grey['00'], p.grey[100]),
    neutralInverted: byMode(p.grey['00'], p.grey[100]),
    neutralFaint: p.grey[400],
    neutralInvertedMuted: byMode(p.grey[600], p.grey[500]),

    // EVIDENCE: the first pine step past 4.5:1 on every layer.
    brand: byMode(p.pine[800], p.pine[700]),
    brandContrast: p.pine[900],
    onBrandSolid: fixed(s.white),

    // WHY: a role of its own though it starts on a brand step: it means something else (COLOR-02),
    // so it can move without moving the brand.
    ai: p.pine[800],

    critical: p.red[700],
    criticalContrast: p.red[900],
    onCriticalSolid: fixed(s.white),

    informative: p.blue[700],
    informativeContrast: p.blue[900],
    onInformativeSolid: fixed(s.white),

    positive: p.green[700],
    positiveContrast: p.green[900],
    onPositiveSolid: fixed(s.white),

    warning: p.yellow[700],
    warningContrast: p.yellow[900],
    // WHY: `bg.warningSolid` is a light yellow in both modes, so its ink is dark.
    onWarningSolid: fixed(s.blackAlpha900),

    onToast: fixed(s.white),
    onToastAction: byMode(p.blue[500], p.blue[800]),
    onToastPositive: byMode(p.green[600], p.green[700]),
    onToastWarning: fixed(s.toastWarning),
  },

  bg: {
    layerBasement: byMode(p.grey[200], p.grey['00']),
    layerBasementPressed: byMode(p.grey[300], p.grey[100]),
    layerDefault: byMode(p.grey['00'], p.grey[100]),
    layerDefaultPressed: byMode(p.grey[100], p.grey[300]),
    layerFloating: byMode(p.grey['00'], p.grey[200]),
    layerFloatingPressed: byMode(p.grey[100], p.grey[300]),

    // WHY: one step nearer the background than SEED's (800, not 900), the neutral button's fill;
    // its pressed step moves toward the background, as SEED's does.
    neutralSolid: byMode(p.grey[800], p.grey[1000]),
    neutralSolidPressed: byMode(p.grey[700], p.grey[800]),
    neutralWeak: byMode(p.grey[200], p.grey[300]),
    neutralWeakPressed: byMode(p.grey[300], p.grey[400]),
    neutralMuted: byMode(p.grey[100], p.grey[200]),
    neutralMutedPressed: byMode(p.grey[200], p.grey[300]),
    neutralSubtle: byMode(p.grey['00'], p.grey[100]),
    // WHY: the far end of the scale (1000, not SEED's 900), the dark fill SDS draws there; in dark it
    // turns near-white.
    neutralInverted: p.grey[1000],
    neutralInvertedPressed: p.grey[900],

    brandSolid: byMode(p.pine[900], p.pine[500]),
    brandSolidPressed: byMode(p.pine[1000], p.pine[600]),
    // EVIDENCE: dark 200, not SEED's 100: pine and green share a hue, and at dark 100 their chroma is
    // too low to tell brand from `positiveWeak` at all.
    brandWeak: byMode(p.pine[100], p.pine[200]),
    brandWeakPressed: byMode(p.pine[200], p.pine[300]),

    aiWeak: p.pine[100],
    aiWeakPressed: p.pine[200],

    criticalSolid: byMode(p.red[700], p.red[600]),
    criticalSolidPressed: byMode(p.red[800], p.red[700]),
    criticalWeak: p.red[100],
    criticalWeakPressed: p.red[200],

    informativeSolid: byMode(p.blue[700], p.blue[600]),
    informativeSolidPressed: byMode(p.blue[800], p.blue[700]),
    informativeWeak: p.blue[100],
    informativeWeakPressed: p.blue[200],

    positiveSolid: byMode(p.green[700], p.green[500]),
    positiveSolidPressed: byMode(p.green[800], p.green[600]),
    positiveWeak: p.green[100],
    positiveWeakPressed: p.green[200],

    warningSolid: byMode(p.yellow[300], p.yellow[800]),
    warningSolidPressed: byMode(p.yellow[400], p.yellow[900]),
    warningWeak: p.yellow[100],
    warningWeakPressed: p.yellow[200],

    disabled: byMode(p.grey[200], p.grey[300]),
    overlay: fixed(s.scrim),
    overlayPressed: fixed(s.blackAlpha900),
    overlayMuted: fixed(s.scrimGlass),
    transparent: fixed(s.transparent),
    transparentPressed: { light: s.blackAlpha100, dark: s.whiteAlpha50 },
    transparentSelected: { light: s.blackAlpha200, dark: s.whiteAlpha100 },
    transparentSelectedPressed: { light: s.blackAlpha300, dark: s.whiteAlpha200 },

    toast: fixed(s.toast),
    glassTint: { light: s.glassTintLight, dark: s.glassTintDark },
    // EVIDENCE: `neutralWeak` (grey 200) vanishes into Liquid Glass; 10% black in light and 18% white
    // in dark is the range iOS's own secondary fills sit in, and reads on a white sheet too.
    glassControl: { light: s.blackAlpha400, dark: s.whiteAlpha300 },
    glassControlPressed: { light: s.blackAlpha500, dark: s.whiteAlpha400 },

    // WHY: the default for a data color the data leaves empty, a role of its own (COLOR-02) though the
    // brand's green: it marks a line or a place, never an action. The maps read it light-only.
    dataBrand: byMode(p.pine[700], p.pine[700]),
    // EVIDENCE: the reference stop pin samples #E46F5A, nearest red 600. Not `dataBrand`, a route's
    // default colour, on which a stop would vanish.
    dataStop: byMode(p.red[600], p.red[600]),
  },

  stroke: {
    neutralContrast: p.grey[1000],
    neutralSolid: p.grey[800],
    neutralWeak: p.grey[400],
    neutralMuted: { light: s.blackAlpha300, dark: s.whiteAlpha100 },
    neutralSubtle: { light: s.blackAlpha200, dark: s.whiteAlpha50 },
    control: p.grey[500],

    brandSolid: p.pine[900],
    brandWeak: p.pine[300],

    criticalSolid: p.red[700],
    criticalWeak: p.red[300],
    informativeSolid: p.blue[700],
    informativeWeak: p.blue[300],
    positiveSolid: p.green[700],
    positiveWeak: p.green[300],
    warningSolid: p.yellow[700],
    warningWeak: p.yellow[300],
  },
} as const satisfies SemanticShape;

type Steps = typeof semanticColorSteps;

declare const sdsColorBrand: unique symbol;

/** WHY: branded so a slot typed `SdsColor` takes a role's value and refuses a hex; types only. */
export type SdsColor = string & { readonly [sdsColorBrand]: true };

/** WHY: for a color no role names, such as one arriving as data; each call is a greppable exception. */
export function asSdsColor(value: string): SdsColor {
  return value as SdsColor;
}

export type SemanticColors = {
  readonly [G in keyof Steps]: { readonly [K in keyof Steps[G]]: SdsColor };
};

export type FgColorName = keyof Steps['fg'];
export type BgColorName = keyof Steps['bg'];
export type StrokeColorName = keyof Steps['stroke'];

function resolveGroup<T extends Readonly<Record<string, AdaptiveColor>>>(
  group: T,
  mode: ColorMode,
): { readonly [K in keyof T]: SdsColor } {
  const resolved = {} as Record<keyof T, SdsColor>;
  for (const [name, color] of Object.entries(group) as [keyof T, AdaptiveColor][]) {
    resolved[name] = asSdsColor(color[mode]);
  }
  return resolved;
}

export function resolveSemanticColors(mode: ColorMode): SemanticColors {
  return {
    fg: resolveGroup(semanticColorSteps.fg, mode),
    bg: resolveGroup(semanticColorSteps.bg, mode),
    stroke: resolveGroup(semanticColorSteps.stroke, mode),
  };
}

/**
 * WHY: read through `useSemanticColors()` or `createThemedStyles()` from @skkuverse/sds, which
 * follow the resolved scheme; indexing this at module scope stays light.
 */
export const SdsSemanticColors: Readonly<Record<ColorMode, SemanticColors>> = {
  light: resolveSemanticColors('light'),
  dark: resolveSemanticColors('dark'),
};
