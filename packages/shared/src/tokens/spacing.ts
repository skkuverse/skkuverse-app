/** WHY: vendored byte for byte into skkuverse-web and skkuverse-mini, so no imports. */

const scale = {
  x0_5: 2,
  x1: 4,
  x1_5: 6,
  x2: 8,
  x2_5: 10,
  x3: 12,
  x3_5: 14,
  x4: 16,
  x4_5: 18,
  x5: 20,
  x6: 24,
  x7: 28,
  x8: 32,
  x9: 36,
  x10: 40,
  x12: 48,
  x13: 52,
  x14: 56,
  x16: 64,
} as const;

export const SdsSpacing = {
  ...scale,
  // SEE: docs/decisions/0017-add-a-screen-gutter-token.md
  gutter: scale.x5,
  // WHY: the TDS names below are aliases that vendored web copies still read; the app reads the scale names.
  /** @deprecated Use `x0_5`. */
  xxs: scale.x0_5,
  /** @deprecated Use `x1`. */
  xs: scale.x1,
  /** @deprecated Use `x2`. */
  sm: scale.x2,
  /** @deprecated Use `x3`. */
  md: scale.x3,
  /** @deprecated Use `x4`. */
  base: scale.x4,
  /** @deprecated Use `x5`. */
  lg: scale.x5,
  /** @deprecated Use `x6`. */
  xl: scale.x6,
  /** @deprecated Use `x8`. */
  xxl: scale.x8,
} as const;
