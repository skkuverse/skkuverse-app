import { describe, expect, test } from 'vitest';
import { HANDOFF_WINDOW_MS, handoffFor } from './handoff.rules';

describe('handoffFor', () => {
  const mark = { kind: 'permission' as const, at: 1_000 };

  test('a background soon after the mark came from it', () => {
    expect(handoffFor(mark, 1_000)).toBe('permission');
    expect(handoffFor(mark, 1_000 + HANDOFF_WINDOW_MS)).toBe('permission');
  });

  test('a background long after the mark, or before it, did not', () => {
    expect(handoffFor(mark, 1_001 + HANDOFF_WINDOW_MS)).toBe(undefined);
    expect(handoffFor(mark, 999)).toBe(undefined);
    expect(handoffFor(null, 1_000)).toBe(undefined);
  });
});
