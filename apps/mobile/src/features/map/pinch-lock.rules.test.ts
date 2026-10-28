/**
 * The scroll lock that keeps a pinch zooming about the location dot.
 *
 * The cases that would hurt are the seams: the SDK dropping tracking at the
 * start of the pinch (which must not unlock it), a pinch ending on one finger
 * (which must stay locked), and a plain drag (which must never lock).
 */

import { describe, expect, it } from 'vitest';
import { NO_PINCH, stepPinchLock } from './pinch-lock.rules';

describe('stepPinchLock', () => {
  it('locks at the second finger while following', () => {
    const one = stepPinchLock(NO_PINCH, 1, true);
    expect(one.locked, 'one finger is a drag, and drags scroll').toBe(false);
    expect(stepPinchLock(one, 2, true)).toStrictEqual({ pinching: true, locked: true });
  });

  it('does not lock a pinch on a map that is not following', () => {
    expect(stepPinchLock(NO_PINCH, 2, false)).toStrictEqual({ pinching: true, locked: false });
  });

  it('keeps the lock when tracking drops mid-pinch', () => {
    // The SDK reports NoFollow at the start of the pinch; the lock was decided
    // from the mode before that and must not follow it.
    const locked = stepPinchLock(NO_PINCH, 2, true);
    expect(stepPinchLock(locked, 2, false)).toBe(locked);
  });

  it('stays locked while the last finger drags', () => {
    const locked = stepPinchLock(NO_PINCH, 2, true);
    expect(stepPinchLock(locked, 1, false).locked).toBe(true);
  });

  it('lets go when every finger is up', () => {
    const locked = stepPinchLock(NO_PINCH, 2, true);
    expect(stepPinchLock(locked, 0, false)).toBe(NO_PINCH);
  });

  it('does not re-decide when tracking starts mid-pinch', () => {
    const loose = stepPinchLock(NO_PINCH, 2, false);
    expect(stepPinchLock(loose, 2, true)).toBe(loose);
  });

  it('keeps the same object for touches that change nothing', () => {
    expect(stepPinchLock(NO_PINCH, 1, true)).toBe(NO_PINCH);
    expect(stepPinchLock(NO_PINCH, 0, true)).toBe(NO_PINCH);
    const locked = stepPinchLock(NO_PINCH, 2, true);
    expect(stepPinchLock(locked, 3, true)).toBe(locked);
  });
});
