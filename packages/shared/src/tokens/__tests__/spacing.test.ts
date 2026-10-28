import { describe, it, expect } from 'vitest';
import { SdsSpacing } from '../spacing';

// The TDS names kept for the vendored web copies (docs/decisions/0013).
const ALIASES = {
  xxs: 'x0_5',
  xs: 'x1',
  sm: 'x2',
  md: 'x3',
  base: 'x4',
  lg: 'x5',
  xl: 'x6',
  xxl: 'x8',
} as const;

// The semantic spacings, each a step under its own name (docs/decisions/0017).
const SEMANTIC = {
  gutter: 'x5',
} as const;

const steps = Object.entries(SdsSpacing).filter(([name]) => !(name in ALIASES) && !(name in SEMANTIC));

describe('SdsSpacing', () => {
  // SEED's dimension scale (daangn/seed-design packages/rootage/dimension.yaml).
  // A changed value is a visual change wherever the step is read.
  it('pins every step', () => {
    expect(Object.fromEntries(steps)).toEqual({
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
    });
  });

  it('carries the value in the name: x{n} is n × 4, x{n}_5 two more', () => {
    for (const [name, value] of steps) {
      const match = /^x(\d+)(_5)?$/.exec(name);
      expect(match, name).not.toBeNull();
      expect(value, name).toBe(Number(match![1]) * 4 + (match![2] ? 2 : 0));
    }
  });

  it('lists the steps smallest first', () => {
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i][1], `${steps[i][0]} vs ${steps[i - 1][0]}`).toBeGreaterThan(steps[i - 1][1]);
    }
  });

  it('points each semantic spacing at its step', () => {
    for (const [name, step] of Object.entries(SEMANTIC)) {
      expect(SdsSpacing[name as keyof typeof SEMANTIC], name).toBe(SdsSpacing[step]);
    }
  });

  it('keeps each TDS name at the value of its step', () => {
    for (const [alias, step] of Object.entries(ALIASES)) {
      expect(SdsSpacing[alias as keyof typeof ALIASES], alias).toBe(SdsSpacing[step]);
    }
  });
});
