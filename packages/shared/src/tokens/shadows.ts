// SEE: docs/decisions/0018-separate-cards-by-surface-not-shadow.md

/**
 * QUIRK(react-native): `boxShadow` needs the New Architecture (RN 0.76+); the other field carries the iOS
 * shadow props and the Android elevation.
 */
interface SdsShadowToken {
  boxShadow: string;
  legacy: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
}

const level1: SdsShadowToken = {
  boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.18)',
  legacy: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
  },
};

const level2: SdsShadowToken = {
  boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
  legacy: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
};

const level3: SdsShadowToken = {
  boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.12)',
  legacy: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
};

/**
 * WHY: `level2` softened beside real Liquid Glass: at full strength it clashes with the glass's
 * specular highlight (Apple HIG). The solid fallback below iOS 26 takes `level2`.
 */
const glassFloat: SdsShadowToken = {
  boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.06)',
  legacy: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
};

/** WHY: not a level: it lifts a part inside a control, not an element above the screen. */
const segmentedIndicator: SdsShadowToken = {
  boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.09)',
  legacy: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.09,
    shadowRadius: 2,
    elevation: 1,
  },
};

export const SdsShadows = {
  level1,
  level2,
  level3,
  glassFloat,
  segmentedIndicator,
} as const;

export type SdsShadowLevel = 'level1' | 'level2' | 'level3';
