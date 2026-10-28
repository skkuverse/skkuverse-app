/**
 * The Checkbox's recipe: checked in blue, disabled on SEED's disabled roles.
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
  CHECKBOX_CHECK,
  checkboxLineRadius,
  checkboxRecipe,
} from './checkboxRecipe.ts';

const byPath = (group: string) =>
  new Proxy({}, { get: (_target, name) => `${group}.${String(name)}` });

const color = { fg: byPath('fg'), bg: byPath('bg'), stroke: byPath('stroke') } as unknown as SemanticColors;

const compiled = compileRecipe(checkboxRecipe({ scheme: 'light', color, spacing: SdsSpacing, radius: SdsRadius }));
const resolve = (selection: Record<string, string | boolean> = {}) =>
  resolveRecipe(compiled, selection as never);

describe('checkboxRecipe', () => {
  it('outlines the unchecked box 2pt in the control stroke', () => {
    const { box } = resolve();
    assert.equal(box.borderWidth, 2);
    assert.equal(box.borderColor, 'stroke.control');
  });

  it('fills checked in the informative solid under its own label color', () => {
    assert.equal(resolve().fill.backgroundColor, 'bg.informativeSolid');
    assert.equal(CHECKBOX_CHECK.enabled, 'onInformativeSolid');
  });

  it('draws disabled on the disabled roles, never an opacity', () => {
    const styles = resolve({ disabled: true });
    assert.equal(styles.box.backgroundColor, 'bg.disabled');
    assert.equal(styles.box.borderColor, 'stroke.neutralWeak');
    assert.equal(styles.fill.backgroundColor, 'bg.disabled');
    assert.equal(CHECKBOX_CHECK.disabled, 'disabled');
    for (const slot of Object.values(styles)) assert.equal(slot.opacity, undefined);
  });

  it('rounds the circle fully and the line by a quarter of its side', () => {
    assert.equal(resolve({ shape: 'circle' }).box.borderRadius, 9999);
    assert.equal(resolve({ shape: 'line' }).box.borderRadius, undefined);
    assert.equal(checkboxLineRadius(24), 6);
  });

  it('keeps the label 12 off the box', () => {
    assert.equal(resolve().label.marginLeft, 12);
  });
});
