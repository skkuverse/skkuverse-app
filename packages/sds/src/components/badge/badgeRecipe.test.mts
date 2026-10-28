/**
 * The Badge's recipe: the shape per size is the one the Badge drew before it
 * moved onto its recipe.
 *
 * NOTE: packages/sds runs `node --test`, which cannot load @skkuverse/shared,
 * so the colors here are a stand-in that answers every token with its own
 * path ('bg.neutralWeak'). Spacing and radius are the real scales.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SemanticColors } from '@skkuverse/shared';
import { SdsRadius } from '../../../../shared/src/tokens/radius.ts';
import { SdsSpacing } from '../../../../shared/src/tokens/spacing.ts';
import { compileRecipe, resolveRecipe } from '../../core/recipe.ts';
import { BADGE_TEXT, badgeRecipe } from './badgeRecipe.ts';

const byPath = (group: string) =>
  new Proxy({}, { get: (_target, name) => `${group}.${String(name)}` });

const color = { fg: byPath('fg'), bg: byPath('bg'), stroke: byPath('stroke') } as unknown as SemanticColors;

const compiled = compileRecipe(badgeRecipe({ scheme: 'light', color, spacing: SdsSpacing, radius: SdsRadius }));
const resolve = (selection: Record<string, string | boolean> = {}) =>
  resolveRecipe(compiled, selection as never);

describe('badgeRecipe', () => {
  it('keeps each size’s padding and radius', () => {
    const drawn = {
      xsmall: [4, 1, 4],
      small: [6, 2, 6],
      medium: [8, 3, 8],
      large: [10, 4, 10],
    };
    for (const [size, [x, y, r]] of Object.entries(drawn)) {
      const { root } = resolve({ size });
      assert.deepEqual([root.paddingHorizontal, root.paddingVertical, root.borderRadius], [x, y, r], size);
    }
  });

  it('rests as a neutral label', () => {
    const styles = resolve();
    assert.equal(styles.root.backgroundColor, 'bg.neutralWeak');
    assert.equal(styles.label.color, 'fg.neutralSubtle');
    assert.equal(styles.root.alignSelf, 'flex-start');
  });

  it('keeps the text styles per size', () => {
    assert.deepEqual(BADGE_TEXT, {
      xsmall: { typography: 't3', fontWeight: 'semiBold' },
      small: { typography: 't3', fontWeight: 'bold' },
      medium: { typography: 't5', fontWeight: 'bold' },
      large: { typography: 't7', fontWeight: 'bold' },
    });
  });
});
