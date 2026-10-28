import { describe, it, expect } from 'vitest';
import { SdsRadius } from '../radius';

// The TDS names kept for the vendored web copies (docs/decisions/0013).
// TDS's `full` (20) is not among them: the name is SEED's pill now.
const ALIASES = {
  xs: 'r1',
  sm: 'r2',
  md: 'r3',
  lg: 'r3_5',
  xl: 'r4',
} as const;

const steps = Object.entries(SdsRadius).filter(([name]) => !(name in ALIASES));

describe('SdsRadius', () => {
  // SEED's radius scale (daangn/seed-design packages/rootage/radius.yaml).
  // A changed value is a visual change wherever the step is read.
  it('pins every step', () => {
    expect(Object.fromEntries(steps)).toEqual({
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
      full: 9999,
    });
  });

  // TDS's `full` was 20. A read of it that meant a 20px corner moved to `r5`.
  it('makes full a pill, not a size', () => {
    expect(SdsRadius.full).toBe(9999);
  });

  it('carries the value in the name: r{n} is n × 4, r{n}_5 two more', () => {
    for (const [name, value] of steps.filter(([n]) => n !== 'full')) {
      const match = /^r(\d+)(_5)?$/.exec(name);
      expect(match, name).not.toBeNull();
      expect(value, name).toBe(Number(match![1]) * 4 + (match![2] ? 2 : 0));
    }
  });

  it('lists the steps smallest first, full last', () => {
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i][1], `${steps[i][0]} vs ${steps[i - 1][0]}`).toBeGreaterThan(steps[i - 1][1]);
    }
    expect(steps.at(-1)![0]).toBe('full');
  });

  it('keeps each TDS name at the value of its step', () => {
    for (const [alias, step] of Object.entries(ALIASES)) {
      expect(SdsRadius[alias as keyof typeof ALIASES], alias).toBe(SdsRadius[step]);
    }
  });
});
