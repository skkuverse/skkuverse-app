import { describe, it, expect } from 'vitest';
import { SdsTypeScale, SdsTypo, typoWeights } from '../typography';

// The neutral table the umbrella copies to the web repos. The app reads it
// resolved per platform (textStyles.test.ts).

const steps = Object.entries(SdsTypeScale);

describe('SdsTypeScale', () => {
  // The values are SDS's own and every one is in use. Changing one is a visual
  // change across the app, so this pin moves only with a decision behind it
  // (docs/decisions/0012).
  it('pins every step', () => {
    expect(SdsTypeScale).toEqual({
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
    });
  });

  it('numbers the steps t1, t2, … with no gap', () => {
    expect(steps.map(([name]) => name)).toEqual(steps.map((_, i) => `t${i + 1}`));
  });

  // SEED's direction. TDS ran the other way (t1 = 30px), and a name that
  // flips meaning compiles fine everywhere it is used.
  it('starts at the smallest size and grows with the number', () => {
    for (let i = 1; i < steps.length; i++) {
      const [prevName, prev] = steps[i - 1];
      const [name, step] = steps[i];
      expect(step.fontSize, `${name} vs ${prevName}`).toBeGreaterThan(prev.fontSize);
      expect(step.lineHeight, `${name} vs ${prevName}`).toBeGreaterThan(prev.lineHeight);
    }
  });
});

describe('SdsTypo', () => {
  it('names each style after its step and its weight', () => {
    for (const [name, style] of Object.entries(SdsTypo)) {
      const match = /^(t\d+)(Regular|Medium|SemiBold|Bold)$/.exec(name);
      expect(match, name).not.toBeNull();
      const [, step, weight] = match!;
      expect(style, name).toEqual({
        fontFamily: 'WantedSans',
        fontWeight: typoWeights[weight as keyof typeof typoWeights],
        ...SdsTypeScale[step as keyof typeof SdsTypeScale],
      });
    }
  });

  // What a web adapter reads from its copy: the logical family and a
  // numeric weight, the same on every platform.
  it('pins every style, platform-neutral', () => {
    expect(SdsTypo).toEqual({
      t1SemiBold: { fontFamily: 'WantedSans', fontWeight: '600', fontSize: 11, lineHeight: 16.5 },
      t2Regular: { fontFamily: 'WantedSans', fontWeight: '400', fontSize: 12, lineHeight: 18 },
      t3Regular: { fontFamily: 'WantedSans', fontWeight: '400', fontSize: 13, lineHeight: 19.5 },
      t5Regular: { fontFamily: 'WantedSans', fontWeight: '400', fontSize: 15, lineHeight: 22.5 },
      t6Regular: { fontFamily: 'WantedSans', fontWeight: '400', fontSize: 16, lineHeight: 24 },
      t7Regular: { fontFamily: 'WantedSans', fontWeight: '400', fontSize: 17, lineHeight: 25.5 },
      t9Bold: { fontFamily: 'WantedSans', fontWeight: '700', fontSize: 20, lineHeight: 29 },
      t10Bold: { fontFamily: 'WantedSans', fontWeight: '700', fontSize: 22, lineHeight: 31 },
      t11Bold: { fontFamily: 'WantedSans', fontWeight: '700', fontSize: 26, lineHeight: 35 },
      t13Bold: { fontFamily: 'WantedSans', fontWeight: '700', fontSize: 30, lineHeight: 40 },
    });
  });

  it('holds the styles the app reads', () => {
    expect(Object.keys(SdsTypo)).toEqual([
      't1SemiBold',
      't2Regular',
      't3Regular',
      't5Regular',
      't6Regular',
      't7Regular',
      't9Bold',
      't10Bold',
      't11Bold',
      't13Bold',
    ]);
  });
});
