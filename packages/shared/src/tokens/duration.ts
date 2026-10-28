export const SdsDuration = {
  instant: 100,
  fast: 150,
  normal: 200,
  slow: 250,
  slower: 500,
  toast: 3000,
  toastWithAction: 5000,
} as const;

export const SdsCurves = {
  standard: [0.33, 1, 0.68, 1] as const,
  /**
   * WHY: SEED's `$timing-function.pressed-scale`: the surface color and the scale move on it together,
   * over `SdsDuration.fast`.
   */
  pressed: [0, 0, 0.15, 1] as const,
} as const;
