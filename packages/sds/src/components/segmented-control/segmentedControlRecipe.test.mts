/**
 * The SegmentedControl's recipe: the track and the segments are the ones
 * the control drew before it moved onto its recipe.
 *
 * NOTE: packages/sds runs `node --test`, which cannot load @skkuverse/shared,
 * so the colors here are a stand-in that answers every token with its own
 * path. Spacing and radius are the real scales.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SemanticColors } from '@skkuverse/shared';
import { SdsRadius } from '../../../../shared/src/tokens/radius.ts';
import { SdsSpacing } from '../../../../shared/src/tokens/spacing.ts';
import { compileRecipe, resolveRecipe } from '../../core/recipe.ts';
import {
  SEGMENTED_LABEL_WEIGHT,
  segmentedControlRecipe,
  segmentedTrackInset,
} from './segmentedControlRecipe.ts';

const byPath = (group: string) =>
  new Proxy({}, { get: (_target, name) => `${group}.${String(name)}` });

const color = { fg: byPath('fg'), bg: byPath('bg'), stroke: byPath('stroke') } as unknown as SemanticColors;

const compiled = compileRecipe(
  segmentedControlRecipe({ scheme: 'light', color, spacing: SdsSpacing, radius: SdsRadius }),
);
const resolve = (selection: Record<string, string | boolean> = {}) =>
  resolveRecipe(compiled, selection as never);

describe('segmentedControlRecipe', () => {
  it('draws the track on the weak neutral surface, inset 2 with a 10 radius', () => {
    const { track } = resolve();
    assert.equal(track.backgroundColor, 'bg.neutralWeak');
    assert.equal(track.padding, 2);
    assert.equal(track.borderRadius, 10);
    assert.equal(segmentedTrackInset({ spacing: SdsSpacing }), 2);
  });

  it('lifts the indicator on the default layer, at the track’s inset', () => {
    const { indicator } = resolve();
    assert.equal(indicator.backgroundColor, 'bg.layerDefault');
    assert.equal(indicator.left, 2);
  });

  it('labels a segment subtle at rest and neutral when selected', () => {
    assert.equal(resolve().label.color, 'fg.neutralSubtle');
    assert.equal(resolve({ selected: true }).label.color, 'fg.neutral');
    assert.deepEqual(SEGMENTED_LABEL_WEIGHT, { selected: 'semiBold', rest: 'regular' });
  });

  it('keeps the segment’s 8 of vertical padding', () => {
    assert.equal(resolve().item.paddingVertical, 8);
  });
});
