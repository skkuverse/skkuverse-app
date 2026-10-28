/**
 * A layer fill inside a glass sheet, and the same fill on a page.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { surfaceBg } from './surface.ts';
import { pressedBgToken } from './pressFeedback.ts';

describe('surfaceBg', () => {
  it('keeps every fill on a page', () => {
    for (const bg of ['layerDefault', 'layerFloating', 'neutralWeak', 'transparent'] as const) {
      assert.equal(surfaceBg(bg, 'opaque'), bg);
    }
  });

  it('drops the layer roles inside a glass sheet, which draws the layer itself', () => {
    assert.equal(surfaceBg('layerDefault', 'glass'), 'transparent');
    assert.equal(surfaceBg('layerFloating', 'glass'), 'transparent');
  });

  it('keeps a fill that is not the layer inside a glass sheet: a chip, a selected state, the ground', () => {
    for (const bg of ['neutralWeak', 'brandSolid', 'brandWeak', 'layerBasement', 'transparent'] as const) {
      assert.equal(surfaceBg(bg, 'glass'), bg);
    }
  });

  it('still shows a press on glass', () => {
    assert.equal(pressedBgToken(surfaceBg('layerDefault', 'glass')), 'transparentPressed');
  });
});
