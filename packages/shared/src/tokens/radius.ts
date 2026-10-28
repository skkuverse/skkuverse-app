/** WHY: vendored byte for byte into skkuverse-web and skkuverse-mini, so no imports. */

const scale = {
  r0_5: 2,
  r1: 4,
  r1_5: 6,
  r2: 8,
  r2_5: 10,
  r3: 12,
  r3_5: 14,
  r4: 16,
  r5: 20,
  r6: 24,
  // QUIRK(react-native): a radius larger than the box scales down to half its shorter side, so 9999 rounds any size.
  full: 9999,
} as const;

export const SdsRadius = {
  ...scale,
  // WHY: the TDS names below are aliases that vendored web copies still read; the app reads the scale names.
  /** @deprecated Use `r1`. */
  xs: scale.r1,
  /** @deprecated Use `r2`. */
  sm: scale.r2,
  /** @deprecated Use `r3`. */
  md: scale.r3,
  /** @deprecated Use `r3_5`. */
  lg: scale.r3_5,
  /** @deprecated Use `r4`. */
  xl: scale.r4,
} as const;
