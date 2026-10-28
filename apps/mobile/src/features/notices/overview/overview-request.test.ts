import { describe, it, expect } from 'vitest';
import { canRequestOverview, normalizeOverviewQuery } from './overview.rules';

const ONE = ['skku-main'];

describe('canRequestOverview', () => {
  it('accepts 1 and 100 codepoints, rejects 0 and 101', () => {
    expect(canRequestOverview('장', ONE)).toBe(true);
    expect(canRequestOverview('가'.repeat(100), ONE)).toBe(true);
    expect(canRequestOverview('   ', ONE)).toBe(false);
    expect(canRequestOverview('가'.repeat(101), ONE)).toBe(false);
  });

  it('counts codepoints, not UTF-16 units', () => {
    // 😀 is two UTF-16 units; 100 of them is 200 units but 100 codepoints.
    expect(canRequestOverview('😀'.repeat(100), ONE)).toBe(true);
    expect(canRequestOverview('😀'.repeat(101), ONE)).toBe(false);
  });

  it('trims before counting', () => {
    expect(canRequestOverview(`  ${'가'.repeat(100)}  `, ONE)).toBe(true);
  });

  it('rejects control characters', () => {
    expect(canRequestOverview('장학\u0007', ONE)).toBe(false);
    expect(canRequestOverview('장\u007f학', ONE)).toBe(false);
  });

  it('needs 1–20 sources', () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `s${i}`);
    expect(canRequestOverview('장학', ids(0))).toBe(false);
    expect(canRequestOverview('장학', ids(1))).toBe(true);
    expect(canRequestOverview('장학', ids(20))).toBe(true);
    expect(canRequestOverview('장학', ids(21))).toBe(false);
  });
});

describe('normalizeOverviewQuery', () => {
  it('trims, collapses whitespace and lower-cases', () => {
    expect(normalizeOverviewQuery('  ROTC   언제\t까지 ')).toBe('rotc 언제 까지');
  });
});
