/**
 * The TextButton's recipe: the label per variant and state.
 *
 * NOTE: packages/sds runs `node --test`, which cannot load @skkuverse/shared,
 * so the colors here are a stand-in that answers every token with its own
 * path ('fg.neutral'). The values are pinned in
 * packages/shared/src/tokens/__tests__/semanticColors.test.ts.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SemanticColors } from '@skkuverse/shared';
import { SdsRadius } from '../../../../shared/src/tokens/radius.ts';
import { SdsSpacing } from '../../../../shared/src/tokens/spacing.ts';
import { compileRecipe, resolveRecipe } from '../../core/recipe.ts';
import { textButtonRecipe } from './textButtonRecipe.ts';

const byPath = (group: string) =>
  new Proxy({}, { get: (_target, name) => `${group}.${String(name)}` });

const color = { fg: byPath('fg'), bg: byPath('bg'), stroke: byPath('stroke') } as unknown as SemanticColors;

const compiled = compileRecipe(textButtonRecipe({ scheme: 'light', color, spacing: SdsSpacing, radius: SdsRadius }));
const resolve = (selection: Record<string, string | boolean> = {}) =>
  resolveRecipe(compiled, selection as never);

describe('textButtonRecipe', () => {
  it('rests as a neutral label that hugs its text', () => {
    assert.deepEqual(resolve(), {
      root: { alignSelf: 'flex-start' },
      label: { color: 'fg.neutral' },
    });
  });

  it('underlines only the underline variant', () => {
    assert.equal(resolve({ variant: 'underline' }).label.textDecorationLine, 'underline');
    assert.equal(resolve({ variant: 'arrow' }).label.textDecorationLine, undefined);
    assert.equal(resolve({ variant: 'clear' }).label.textDecorationLine, undefined);
  });

  it('draws disabled with the disabled role, never an opacity', () => {
    for (const variant of ['arrow', 'underline', 'clear']) {
      const styles = resolve({ variant, disabled: true });
      assert.equal(styles.label.color, 'fg.disabled', variant);
      assert.equal(styles.label.opacity, undefined, variant);
      assert.equal(styles.root.opacity, undefined, variant);
    }
  });
});
