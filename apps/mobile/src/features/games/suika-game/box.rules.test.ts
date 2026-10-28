/**
 * The overlay's box sits where the page reports it draws the box.
 */
import { describe, expect, it } from 'vitest';
import { boxOf } from './box.rules';

describe('boxOf', () => {
  const screen = { width: 393, height: 852 };
  const reported = { x: 25, y: 300, width: 340, height: 400 };

  it('places a hosted page\'s title in the rectangle it reported, and follows it when it moves', () => {
    expect(boxOf({ reported, ...screen })).toStrictEqual(reported);
    const moved = { x: 40, y: 180, width: 300, height: 352 };
    expect(boxOf({ reported: moved, ...screen })).toStrictEqual(moved);
  });

  it('gives a hosted page that reported nothing the whole screen', () => {
    expect(boxOf({ reported: null, ...screen })).toStrictEqual({ x: 0, y: 0, width: 393, height: 852 });
  });
});
