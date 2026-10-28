/**
 * Press feedback decisions (ADR 0014): the distance-based scale, the
 * pressed pair of a surface, and when a press gives which feedback.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateScaleFeedback,
  pressedBgToken,
  resolvePressFeedback,
  scopeScales,
  SCALE_FEEDBACK_DEPTH,
  SCALE_FEEDBACK_MIN_BASIS,
  SCALE_FEEDBACK_WIDTH_DIVISOR,
  type PressFeedbackInput,
} from './pressFeedback.ts';

const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} ≈ ${expected}`);

describe('calculateScaleFeedback', () => {
  it("keeps SEED's constants", () => {
    assert.equal(SCALE_FEEDBACK_DEPTH, 2);
    assert.equal(SCALE_FEEDBACK_WIDTH_DIVISOR, 4);
    assert.equal(SCALE_FEEDBACK_MIN_BASIS, 24);
  });

  // The cases SEED Lynx's own test pins (useScaleFeedback.test.ts).
  it('measures from the height when the element is no wider than four times it', () => {
    close(calculateScaleFeedback(32, 32), 30 / 32);
    close(calculateScaleFeedback(120, 48), 46 / 48);
  });

  it('measures a wide element from a quarter of its width', () => {
    close(calculateScaleFeedback(343, 48), (343 / 4 - 2) / (343 / 4));
  });

  it('never measures from less than 24', () => {
    close(calculateScaleFeedback(22, 22), 22 / 24);
    close(calculateScaleFeedback(0, 0), 22 / 24);
  });

  it('sinks every element by the same distance', () => {
    for (const [width, height] of [
      [52, 32],
      [96, 56],
      [390, 56],
      [720, 48],
    ] as const) {
      const basis = Math.max(height, width / 4, 24);
      close(basis - basis * calculateScaleFeedback(width, height), 2);
    }
  });

  it('does not scale an element it cannot measure', () => {
    assert.equal(calculateScaleFeedback(Number.NaN, Number.NaN), 1);
  });
});

describe('pressedBgToken', () => {
  it('names the -pressed pair of a surface', () => {
    assert.equal(pressedBgToken('brandSolid'), 'brandSolidPressed');
    assert.equal(pressedBgToken('neutralWeak'), 'neutralWeakPressed');
    assert.equal(pressedBgToken('transparent'), 'transparentPressed');
    assert.equal(pressedBgToken('transparentSelected'), 'transparentSelectedPressed');
  });
});

const enabled: PressFeedbackInput = {
  feedback: 'both',
  hasSurface: true,
  disabled: false,
  loading: false,
  reducedMotion: false,
  insideScalingPressable: false,
};

describe('resolvePressFeedback', () => {
  it('gives color and scale by default', () => {
    assert.deepEqual(resolvePressFeedback(enabled), { color: true, scale: true });
  });

  it('gives no feedback while disabled or loading', () => {
    assert.deepEqual(resolvePressFeedback({ ...enabled, disabled: true }), { color: false, scale: false });
    assert.deepEqual(resolvePressFeedback({ ...enabled, loading: true }), { color: false, scale: false });
  });

  it('keeps the color and drops the scale under reduce motion', () => {
    assert.deepEqual(resolvePressFeedback({ ...enabled, reducedMotion: true }), { color: true, scale: false });
  });

  it('does not scale inside a pressable that already scales, and keeps the color', () => {
    assert.deepEqual(resolvePressFeedback({ ...enabled, insideScalingPressable: true }), {
      color: true,
      scale: false,
    });
  });

  it('has no color to change without a surface', () => {
    assert.deepEqual(resolvePressFeedback({ ...enabled, hasSurface: false }), { color: false, scale: true });
  });

  it('gives only what `feedback` asks for', () => {
    assert.deepEqual(resolvePressFeedback({ ...enabled, feedback: 'scale' }), { color: false, scale: true });
    assert.deepEqual(resolvePressFeedback({ ...enabled, feedback: 'color' }), { color: true, scale: false });
    assert.deepEqual(resolvePressFeedback({ ...enabled, feedback: 'none' }), { color: false, scale: false });
  });
});

describe('scopeScales', () => {
  const context = {
    feedback: 'both',
    hasSurface: true,
    reducedMotion: false,
    insideScalingPressable: false,
  } as const;

  it('tells descendants when this pressable scales', () => {
    assert.equal(scopeScales(context), true);
    assert.equal(scopeScales({ ...context, feedback: 'color' }), false);
    assert.equal(scopeScales({ ...context, reducedMotion: true }), false);
  });

  it('passes an ancestor that scales down the tree', () => {
    assert.equal(scopeScales({ ...context, feedback: 'none', insideScalingPressable: true }), true);
  });
});
