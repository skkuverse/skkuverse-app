/**
 * The Border's recipe: a line or a spacer per variant.
 *
 * NOTE: packages/sds runs `node --test`, which cannot load @skkuverse/shared,
 * so the colors here are a stand-in that answers every token with its own
 * path ('stroke.neutralSubtle'). Spacing and radius are the real scales.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SemanticColors } from '@skkuverse/shared';
import { SdsRadius } from '../../../../shared/src/tokens/radius.ts';
import { SdsSpacing } from '../../../../shared/src/tokens/spacing.ts';
import { compileRecipe, resolveRecipe } from '../../core/recipe.ts';
import { borderRecipe } from './borderRecipe.ts';

const byPath = (group: string) =>
  new Proxy({}, { get: (_target, name) => `${group}.${String(name)}` });

const color = { fg: byPath('fg'), bg: byPath('bg'), stroke: byPath('stroke') } as unknown as SemanticColors;

const compiled = compileRecipe(borderRecipe({ scheme: 'light', color, spacing: SdsSpacing, radius: SdsRadius }));
const resolve = (selection: Record<string, string | boolean> = {}) =>
  resolveRecipe(compiled, selection as never);

describe('borderRecipe', () => {
  it('draws the item lines in the subtle stroke, padding24 inset by 24', () => {
    assert.deepEqual(resolve({ variant: 'full' }).root, { backgroundColor: 'stroke.neutralSubtle' });
    assert.deepEqual(resolve({ variant: 'padding24' }).root, {
      backgroundColor: 'stroke.neutralSubtle',
      marginHorizontal: 24,
    });
  });

  it('draws height16 as a 16-tall band of the muted surface', () => {
    assert.deepEqual(resolve({ variant: 'height16' }).root, { height: 16, backgroundColor: 'bg.neutralMuted' });
  });

  it('defaults to the full line', () => {
    assert.deepEqual(resolve(), resolve({ variant: 'full' }));
  });
});
