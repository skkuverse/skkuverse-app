/** WHY: vendored byte for byte into skkuverse-web and skkuverse-mini, so no imports. */

export type ColorMode = 'light' | 'dark';

export type AdaptiveColor = Readonly<Record<ColorMode, string>>;

type Step = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 1000;
type Scale = Readonly<Record<Step, AdaptiveColor>>;

interface PaletteShape {
  grey: Scale & { readonly '00': AdaptiveColor };
  blue: Scale;
  red: Scale;
  orange: Scale;
  yellow: Scale;
  green: Scale;
  teal: Scale;
  purple: Scale;
  pine: Scale;
  static: Readonly<Record<string, string>>;
}

export const SdsPalette = {
  grey: {
    '00': { light: '#FFFFFF', dark: '#000000' },
    100: { light: '#F7F8F9', dark: '#16171B' },
    200: { light: '#F3F4F5', dark: '#1D2025' },
    300: { light: '#EEEFF1', dark: '#2B2E35' },
    400: { light: '#DCDEE3', dark: '#393D46' },
    500: { light: '#B0B8C1', dark: '#5B606A' },
    600: { light: '#8B95A1', dark: '#868B94' },
    700: { light: '#6B7684', dark: '#B0B3BA' },
    800: { light: '#555D6D', dark: '#DCDEE3' },
    900: { light: '#333D4B', dark: '#E9EAEC' },
    1000: { light: '#191F28', dark: '#F3F4F5' },
  },

  blue: {
    100: { light: '#EFF6FF', dark: '#202742' },
    200: { light: '#E2EDFC', dark: '#1E3352' },
    300: { light: '#CBDFFA', dark: '#1A4275' },
    400: { light: '#AACEFD', dark: '#0F559E' },
    500: { light: '#85B8FD', dark: '#1964D8' },
    600: { light: '#4593FC', dark: '#1E82EB' },
    700: { light: '#217CF9', dark: '#41A2F9' },
    800: { light: '#2272EB', dark: '#83BCF9' },
    900: { light: '#1B64DA', dark: '#B9D7FB' },
    1000: { light: '#032451', dark: '#E5F0FE' },
  },

  red: {
    100: { light: '#FDF0F0', dark: '#322323' },
    200: { light: '#FDE7E7', dark: '#4F2624' },
    300: { light: '#FED4D2', dark: '#742826' },
    400: { light: '#FEB7B3', dark: '#A12621' },
    500: { light: '#FE928D', dark: '#CA2319' },
    600: { light: '#FC6A66', dark: '#F73526' },
    700: { light: '#F04452', dark: '#FF6E60' },
    800: { light: '#CA1D13', dark: '#FFA299' },
    900: { light: '#921708', dark: '#F8C5C3' },
    1000: { light: '#4A1209', dark: '#FDF2F2' },
  },

  orange: {
    100: { light: '#FFF3E0', dark: '#2E261B' },
    200: { light: '#FFEACF', dark: '#40311A' },
    300: { light: '#FFD7A8', dark: '#573C16' },
    400: { light: '#FFBD72', dark: '#784A0B' },
    500: { light: '#FE9800', dark: '#9B5B00' },
    600: { light: '#DE8400', dark: '#BD6F00' },
    700: { light: '#B86F14', dark: '#E28600' },
    800: { light: '#8D5921', dark: '#FAA54C' },
    900: { light: '#604123', dark: '#FFCA97' },
    1000: { light: '#332210', dark: '#FFEEDE' },
  },

  yellow: {
    100: { light: '#FFF7DE', dark: '#302819' },
    200: { light: '#FFE08C', dark: '#413218' },
    300: { light: '#FFD158', dark: '#543E15' },
    400: { light: '#FFC342', dark: '#714E15' },
    500: { light: '#EE8F11', dark: '#91601B' },
    600: { light: '#DD7D02', dark: '#B6720D' },
    700: { light: '#9B7821', dark: '#CA901C' },
    800: { light: '#755B22', dark: '#DAB156' },
    900: { light: '#4F3E1F', dark: '#E5D49B' },
    1000: { light: '#2C2512', dark: '#F7F0CD' },
  },

  green: {
    100: { light: '#EDFAF6', dark: '#202926' },
    200: { light: '#D9F6E9', dark: '#20362E' },
    300: { light: '#B9E9D2', dark: '#20493B' },
    400: { light: '#7DDCB3', dark: '#19604C' },
    500: { light: '#42C593', dark: '#117956' },
    600: { light: '#03B26C', dark: '#1B946D' },
    700: { light: '#079171', dark: '#22B27F' },
    800: { light: '#00745F', dark: '#35CE9A' },
    900: { light: '#075445', dark: '#93E5C0' },
    1000: { light: '#0A2B24', dark: '#D4F6EF' },
  },

  teal: {
    100: { light: '#EDF8F8', dark: '#212929' },
    200: { light: '#D8F3F2', dark: '#233637' },
    300: { light: '#B9E7E6', dark: '#224647' },
    400: { light: '#7FD9D9', dark: '#215D5D' },
    500: { light: '#45C3C3', dark: '#127576' },
    600: { light: '#18A5A5', dark: '#229090' },
    700: { light: '#238E8D', dark: '#1FADAD' },
    800: { light: '#1D706F', dark: '#3DCBCA' },
    900: { light: '#15504F', dark: '#94E1E1' },
    1000: { light: '#0F2929', dark: '#DAF5F5' },
  },

  purple: {
    100: { light: '#F5F3FE', dark: '#28213B' },
    200: { light: '#EFEAFE', dark: '#3B2873' },
    300: { light: '#E1D8FF', dark: '#443081' },
    400: { light: '#D0C0FF', dark: '#5A3BB1' },
    500: { light: '#B8A1FF', dark: '#764FD9' },
    600: { light: '#9F84FB', dark: '#8E6BEE' },
    700: { light: '#8969EA', dark: '#A78DF0' },
    800: { light: '#A234C7', dark: '#BEADF2' },
    900: { light: '#50379B', dark: '#D9CEFA' },
    1000: { light: '#29175D', dark: '#F0EDFC' },
  },

  // WHY: 900 and 1000 vanish on a dark background, so their dark values are light greens.
  pine: {
    100: { light: '#E8F5EE', dark: '#202A25' },
    200: { light: '#D6F4E4', dark: '#22382D' },
    300: { light: '#B6EACE', dark: '#1F4835' },
    400: { light: '#78DCAC', dark: '#1B6043' },
    500: { light: '#3EC78D', dark: '#077950' },
    600: { light: '#1EAE76', dark: '#1D9364' },
    700: { light: '#1A8A5C', dark: '#22B177' },
    800: { light: '#347052', dark: '#64CB98' },
    900: { light: '#1F3D2E', dark: '#B0DEC5' },
    1000: { light: '#003626', dark: '#CCFAE6' },
  },

  static: {
    white: '#FFFFFF',
    black: '#000000',
    greyOpacity50: '#00173305',
    greyOpacity200: '#001B371A',
    greyOpacity500: '#03183275',
    greyOpacity800: '#000C1ECC',
    greyOpacity900: '#020913E8',
    transparent: '#00000000',
    blackAlpha100: '#00000007',
    blackAlpha200: '#0000000C',
    blackAlpha300: '#00000010',
    // EVIDENCE: 10% and 15% sit between iOS's own secondary fills; lighter steps vanish on glass.
    blackAlpha400: '#0000001A',
    blackAlpha500: '#00000026',
    blackAlpha900: '#000000D0',
    whiteAlpha50: '#FFFFFF0D',
    whiteAlpha100: '#FFFFFF17',
    whiteAlpha200: '#FFFFFF20',
    whiteAlpha300: '#FFFFFF2E',
    whiteAlpha400: '#FFFFFF3D',
    scrim: '#00000080',
    // WHY: far lighter than scrim; glass samples what is behind it, so the standard dim flattens it to grey.
    scrimGlass: '#00000033',
    toast: '#212121EB',
    toastWarning: '#FFA726',
    glassTintLight: '#FFFFFFB8',
    glassTintDark: '#16171BB8',
  },
} as const satisfies PaletteShape;

function fixed<T extends string>(value: T): { readonly light: T; readonly dark: T } {
  return { light: value, dark: value };
}

const p = SdsPalette;

const sdsColorSteps = {
  grey50: p.grey[100],
  grey100: p.grey[200],
  grey200: p.grey[300],
  grey300: p.grey[400],
  grey400: p.grey[500],
  grey500: p.grey[600],
  grey600: p.grey[700],
  grey700: p.grey[800],
  grey800: p.grey[900],
  grey900: p.grey[1000],

  greyOpacity50: fixed(p.static.greyOpacity50),
  greyOpacity200: fixed(p.static.greyOpacity200),
  greyOpacity500: fixed(p.static.greyOpacity500),
  greyOpacity800: fixed(p.static.greyOpacity800),
  greyOpacity900: fixed(p.static.greyOpacity900),

  blue50: p.blue[100],
  blue200: p.blue[500],
  blue400: p.blue[600],
  blue500: p.blue[700],
  blue600: p.blue[800],
  blue700: p.blue[900],

  red50: p.red[100],
  red500: p.red[700],

  green50: p.green[100],
  green500: p.green[600],

  orange50: p.orange[100],
  orange500: p.orange[500],

  yellow50: p.yellow[100],
  yellow400: p.yellow[300],
  yellow500: p.yellow[400],
  yellow800: p.yellow[500],
  yellow900: p.yellow[600],

  teal50: p.teal[100],
  teal500: p.teal[600],

  purple500: p.purple[800],

  highlight: p.yellow[200],

  scrim: fixed(p.static.scrim),
  scrimGlass: fixed(p.static.scrimGlass),

  background: { light: p.grey['00'].light, dark: p.grey[100].dark },
  greyBackground: p.grey[200],
  layeredBackground: { light: p.grey['00'].light, dark: p.grey[200].dark },
  floatedBackground: { light: p.grey['00'].light, dark: p.grey[300].dark },

  brand: p.pine[700],
  brandLight: p.pine[100],
  // WHY: lightens in dark like every step; a surface dark in both modes reads the palette value, not this name.
  brandDark: p.pine[1000],
} satisfies Record<string, AdaptiveColor>;

export type SdsColorName = keyof typeof sdsColorSteps;

export function resolveSdsColors(mode: ColorMode): Readonly<Record<SdsColorName, string>> {
  const resolved = {} as Record<SdsColorName, string>;
  for (const name of Object.keys(sdsColorSteps) as SdsColorName[]) {
    resolved[name] = sdsColorSteps[name][mode];
  }
  return resolved;
}

/** WHY: a value read from here stays light in dark mode; new code reads a role from the semantic layer. */
export const SdsColors = resolveSdsColors('light');
