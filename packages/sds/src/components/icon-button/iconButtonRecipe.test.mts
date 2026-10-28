/**
 * The IconButton's recipe and the surface its press reads.
 *
 * NOTE: packages/sds runs `node --test`, which cannot load @skkuverse/shared,
 * so the colors here are a stand-in that answers every token with its own
 * path ('bg.neutralWeak'). The values are pinned in
 * packages/shared/src/tokens/__tests__/semanticColors.test.ts.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SemanticColors } from '@skkuverse/shared';
import { SdsRadius } from '../../../../shared/src/tokens/radius.ts';
import { SdsSpacing } from '../../../../shared/src/tokens/spacing.ts';
import { compileRecipe, resolveRecipe } from '../../core/recipe.ts';
import { ICON_BUTTON_SURFACE, iconButtonRecipe, iconButtonSize } from './iconButtonRecipe.ts';

const byPath = (group: string) =>
  new Proxy({}, { get: (_target, name) => `${group}.${String(name)}` });

const color = { fg: byPath('fg'), bg: byPath('bg'), stroke: byPath('stroke') } as unknown as SemanticColors;

const compiled = compileRecipe(iconButtonRecipe({ scheme: 'light', color, spacing: SdsSpacing, radius: SdsRadius }));
const resolve = (selection: Record<string, string | boolean> = {}) =>
  resolveRecipe(compiled, selection as never);

describe('iconButtonRecipe', () => {
  it('sizes the circle at one and a half icons, as TDS does', () => {
    assert.equal(iconButtonSize(24), 36);
    assert.equal(iconButtonSize(22), 33);
  });

  it('rests ghost: a transparent circle', () => {
    assert.deepEqual(resolve().container, {
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 9999,
      backgroundColor: 'bg.transparent',
    });
  });

  it('draws weak on the weak neutral surface and outline as a muted outline', () => {
    assert.equal(resolve({ variant: 'weak' }).container.backgroundColor, 'bg.neutralWeak');
    const border = resolve({ variant: 'outline' }).container;
    assert.equal(border.backgroundColor, 'bg.transparent');
    assert.equal(border.borderWidth, 1);
    assert.equal(border.borderColor, 'stroke.neutralMuted');
  });

  it('draws each variant on the surface its press turns to the pressed pair', () => {
    for (const [variant, surface] of Object.entries(ICON_BUTTON_SURFACE)) {
      assert.equal(resolve({ variant }).container.backgroundColor, `bg.${surface}`, variant);
    }
  });

  it('fades a disabled button whole at SEED’s disabled opacity', () => {
    for (const variant of ['weak', 'ghost', 'outline']) {
      assert.equal(resolve({ variant, disabled: true }).container.opacity, 0.5, variant);
      assert.equal(resolve({ variant }).container.opacity, undefined, variant);
    }
  });
});
