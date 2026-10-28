/**
 * The Tab's recipe, after SEED's tablist: the insets are the ones the Tab
 * drew before it moved onto its recipe.
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
import { TAB_LABEL_TEXT, tabRecipe } from './tabRecipe.ts';

const byPath = (group: string) =>
  new Proxy({}, { get: (_target, name) => `${group}.${String(name)}` });

const color = { fg: byPath('fg'), bg: byPath('bg'), stroke: byPath('stroke') } as unknown as SemanticColors;

const compiled = compileRecipe(tabRecipe({ scheme: 'light', color, spacing: SdsSpacing, radius: SdsRadius }));
const resolve = (selection: Record<string, string | boolean> = {}) =>
  resolveRecipe(compiled, selection as never);

describe('tabRecipe', () => {
  it('labels a tab subtle at rest and neutral when selected', () => {
    assert.equal(resolve().label.color, 'fg.neutralSubtle');
    assert.equal(resolve({ selected: true }).label.color, 'fg.neutral');
  });

  it('strikes a disabled tab through in the resting color', () => {
    assert.equal(resolve({ disabled: true }).label.textDecorationLine, 'line-through');
    assert.equal(resolve({ disabled: true }).label.color, 'fg.neutralSubtle');
    assert.equal(resolve({ disabled: false }).label.textDecorationLine, undefined);
  });

  it('draws the indicator and the line as SEED’s tablist does', () => {
    const styles = resolve();
    assert.equal(styles.indicator.backgroundColor, 'fg.neutral');
    assert.equal(styles.indicator.height, 2);
    assert.equal(styles.line.backgroundColor, 'stroke.neutralMuted');
    assert.equal(styles.line.height, 1);
  });

  it('shares the width when equal and hugs the text with 16 aside when fluid', () => {
    assert.equal(resolve({ fluid: false }).item.flex, 1);
    assert.equal(resolve({ fluid: true }).item.paddingHorizontal, 16);
    assert.equal(resolve().item.paddingVertical, 12);
  });

  it('keeps the red dot: 6 round, 4 off the label, 8 up', () => {
    const { redBean } = resolve();
    assert.deepEqual(
      [redBean.width, redBean.height, redBean.borderRadius, redBean.marginLeft, redBean.marginTop],
      [6, 6, 9999, 4, -8],
    );
    assert.equal(redBean.backgroundColor, 'bg.criticalSolid');
  });

  it('keeps the text sizes and weights', () => {
    assert.equal(TAB_LABEL_TEXT.large.typography, 't7');
    assert.equal(TAB_LABEL_TEXT.small.typography, 't5');
    assert.equal(TAB_LABEL_TEXT.selected.fontWeight, 'semiBold');
    assert.equal(TAB_LABEL_TEXT.rest.fontWeight, 'regular');
  });
});
