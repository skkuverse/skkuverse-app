import { describe, expect, it } from 'vitest';
import { SdsShadows } from '../shadows';

const LEVELS = ['level1', 'level2', 'level3'] as const;

/** How strongly a shadow lifts: its offset, blur and darkness together. */
function depth(level: (typeof LEVELS)[number]): number[] {
  const { shadowOffset, shadowRadius, shadowOpacity, elevation } = SdsShadows[level].legacy;
  return [shadowOffset.height, shadowRadius, elevation, shadowOpacity];
}

describe('SdsShadows', () => {
  it('is three levels for floating elements, glass\'s softened level 2 and the segmented indicator', () => {
    expect(Object.keys(SdsShadows).sort()).toEqual(['glassFloat', 'level1', 'level2', 'level3', 'segmentedIndicator']);
  });

  it('rises level by level in offset, blur and Android elevation (ELEV-05)', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      const [lowerOffset, lowerBlur, lowerElevation] = depth(LEVELS[i - 1]);
      const [offset, blur, elevation] = depth(LEVELS[i]);
      expect(offset).toBeGreaterThan(lowerOffset);
      expect(blur).toBeGreaterThan(lowerBlur);
      expect(elevation).toBeGreaterThan(lowerElevation);
    }
  });

  it('draws the same shadow through boxShadow and the legacy props', () => {
    for (const name of Object.keys(SdsShadows) as (keyof typeof SdsShadows)[]) {
      const { boxShadow, legacy } = SdsShadows[name];
      const [x, y, blur] = boxShadow.match(/-?\d+(?:\.\d+)?px/g)!.map((v) => Number.parseFloat(v));
      const alpha = Number.parseFloat(boxShadow.match(/rgba\(0, 0, 0, ([\d.]+)\)/)![1]);
      expect({ x, y, blur, alpha }).toEqual({
        x: legacy.shadowOffset.width,
        y: legacy.shadowOffset.height,
        blur: legacy.shadowRadius,
        alpha: legacy.shadowOpacity,
      });
    }
  });

  it('is black in both schemes: a shadow has no role', () => {
    for (const name of Object.keys(SdsShadows) as (keyof typeof SdsShadows)[]) {
      expect(SdsShadows[name].legacy.shadowColor).toBe('#000000');
    }
  });
});
