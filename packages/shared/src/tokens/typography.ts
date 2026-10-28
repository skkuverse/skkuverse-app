/** WHY: vendored byte for byte into skkuverse-web and skkuverse-mini, so no imports. */

export const WANTED_SANS = 'WantedSans';

export type FontWeightValue = '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';

export interface SdsTypeStep {
  fontSize: number;
  lineHeight: number;
}

// SEE: docs/decisions/0012-name-type-scale-in-seed-direction.md
export const SdsTypeScale = {
  t1: { fontSize: 11, lineHeight: 16.5 },
  t2: { fontSize: 12, lineHeight: 18 },
  t3: { fontSize: 13, lineHeight: 19.5 },
  t4: { fontSize: 14, lineHeight: 21 },
  t5: { fontSize: 15, lineHeight: 22.5 },
  t6: { fontSize: 16, lineHeight: 24 },
  t7: { fontSize: 17, lineHeight: 25.5 },
  t8: { fontSize: 18, lineHeight: 27 },
  t9: { fontSize: 20, lineHeight: 29 },
  t10: { fontSize: 22, lineHeight: 31 },
  t11: { fontSize: 26, lineHeight: 35 },
  t12: { fontSize: 28, lineHeight: 38 },
  t13: { fontSize: 30, lineHeight: 40 },
} as const satisfies Record<string, SdsTypeStep>;

export type SdsTypeScaleKey = keyof typeof SdsTypeScale;

export const typoWeights = {
  Regular: '400',
  Medium: '500',
  SemiBold: '600',
  Bold: '700',
} as const satisfies Record<string, FontWeightValue>;

export type SdsTextStyleName = `${SdsTypeScaleKey}${keyof typeof typoWeights}`;

export interface SdsTextStyle {
  fontFamily: string;
  fontWeight: FontWeightValue;
  fontSize: number;
  lineHeight: number;
}

function style(step: SdsTypeScaleKey, weight: keyof typeof typoWeights): SdsTextStyle {
  return { fontFamily: WANTED_SANS, fontWeight: typoWeights[weight], ...SdsTypeScale[step] };
}

/**
 * QUIRK(android): the app reads the per-platform `SdsTypo` in `textStyles.ts`, not this one.
 * Android's family is the font file and its weight is fixed below 700.
 */
export const SdsTypo = {
  t1SemiBold: style('t1', 'SemiBold'),
  t2Regular: style('t2', 'Regular'),
  t3Regular: style('t3', 'Regular'),
  t5Regular: style('t5', 'Regular'),
  t6Regular: style('t6', 'Regular'),
  t7Regular: style('t7', 'Regular'),
  t9Bold: style('t9', 'Bold'),
  t10Bold: style('t10', 'Bold'),
  t11Bold: style('t11', 'Bold'),
  t13Bold: style('t13', 'Bold'),
} as const satisfies Partial<Record<SdsTextStyleName, SdsTextStyle>>;
