// A skeleton's shape sets its radius (LOAD-01): r2 for text, r4 for a card,
// full for an avatar, which is also square by default.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { SdsRadius } from '../../../../shared/src/tokens/radius.ts';
import { skeletonRadius, skeletonWidth } from './skeletonShape.ts';

describe('skeletonRadius', () => {
  it('takes the radius from the shape', () => {
    assert.equal(skeletonRadius(SdsRadius, 'text', undefined), SdsRadius.r2);
    assert.equal(skeletonRadius(SdsRadius, 'card', undefined), SdsRadius.r4);
    assert.equal(skeletonRadius(SdsRadius, 'avatar', undefined), SdsRadius.full);
  });

  it('keeps a caller radius, or the old default, for a block with no shape', () => {
    assert.equal(skeletonRadius(SdsRadius, undefined, SdsRadius.r3), SdsRadius.r3);
    assert.equal(skeletonRadius(SdsRadius, undefined, undefined), SdsRadius.r1_5);
  });
});

describe('skeletonWidth', () => {
  it('makes an avatar as wide as it is tall', () => {
    assert.equal(skeletonWidth('avatar', undefined, 40), 40);
  });

  it('leaves every other width to the caller', () => {
    assert.equal(skeletonWidth('avatar', 32, 40), 32);
    assert.equal(skeletonWidth('text', undefined, 16), undefined);
    assert.equal(skeletonWidth('card', '100%', 120), '100%');
  });
});
