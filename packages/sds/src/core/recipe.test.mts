/**
 * The recipe engine: defaults, variant selection, compound variants and
 * boolean states, compared whole (a partial match would hide a style that
 * leaked in).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compileRecipe, resolveRecipe, variantMapOf } from './recipe.ts';

const definition = {
  base: {
    root: { flexDirection: 'row', borderRadius: 4 },
    label: { fontSize: 13 },
  },
  variants: {
    tone: {
      neutral: { root: { backgroundColor: 'neutral' }, label: { color: 'onNeutral' } },
      brand: { root: { backgroundColor: 'brand' }, label: { color: 'onBrand' } },
      critical: { root: { backgroundColor: 'critical' } },
    },
    size: {
      small: { root: { height: 32 } },
      large: { root: { height: 40, borderRadius: 8 } },
    },
    selected: {
      true: { label: { fontWeight: '700' } },
      false: {},
    },
    disabled: {
      true: { root: { opacity: 0.5 } },
      false: {},
    },
  },
  compoundVariants: [
    { tone: 'brand', selected: true, style: { root: { backgroundColor: 'brandSelected' } } },
    { tone: ['neutral', 'critical'], size: 'large', style: { label: { fontSize: 15 } } },
    { selected: true, disabled: true, style: { label: { color: 'disabled' } } },
  ],
  defaultVariants: { tone: 'neutral', size: 'small', selected: false, disabled: false },
} as const;

const recipe = () => compileRecipe(definition);

describe('resolveRecipe', () => {
  it('resolves the defaults when nothing is selected', () => {
    assert.deepEqual(resolveRecipe(recipe()), {
      root: { flexDirection: 'row', borderRadius: 4, backgroundColor: 'neutral', height: 32 },
      label: { fontSize: 13, color: 'onNeutral' },
    });
  });

  it('takes the default for a value left undefined', () => {
    assert.deepEqual(resolveRecipe(recipe(), { tone: undefined }), resolveRecipe(recipe()));
  });

  it('applies the selected value of each variant over base, in definition order', () => {
    assert.deepEqual(resolveRecipe(recipe(), { tone: 'brand', size: 'large' }), {
      root: { flexDirection: 'row', borderRadius: 8, backgroundColor: 'brand', height: 40 },
      label: { fontSize: 13, color: 'onBrand' },
    });
  });

  it('selects a boolean state with a boolean', () => {
    assert.deepEqual(resolveRecipe(recipe(), { disabled: true }), {
      root: { flexDirection: 'row', borderRadius: 4, backgroundColor: 'neutral', height: 32, opacity: 0.5 },
      label: { fontSize: 13, color: 'onNeutral' },
    });
  });

  it('applies a compound only when every key matches, after the variants', () => {
    assert.deepEqual(resolveRecipe(recipe(), { tone: 'brand', selected: true }).root, {
      flexDirection: 'row',
      borderRadius: 4,
      backgroundColor: 'brandSelected',
      height: 32,
    });
    assert.equal(resolveRecipe(recipe(), { tone: 'neutral', selected: true }).root.backgroundColor, 'neutral');
  });

  it('matches a compound value listed as several', () => {
    assert.equal(resolveRecipe(recipe(), { tone: 'neutral', size: 'large' }).label.fontSize, 15);
    assert.equal(resolveRecipe(recipe(), { tone: 'critical', size: 'large' }).label.fontSize, 15);
    assert.equal(resolveRecipe(recipe(), { tone: 'brand', size: 'large' }).label.fontSize, 13);
  });

  it('matches a compound against the defaults too', () => {
    // size is left at its default, `small`, so the large-only compound stays out.
    assert.equal(resolveRecipe(recipe(), { tone: 'critical' }).label.fontSize, 13);
  });

  it('applies compounds in order, later winning', () => {
    assert.deepEqual(resolveRecipe(recipe(), { tone: 'brand', selected: true, disabled: true }).label, {
      fontSize: 13,
      color: 'disabled',
      fontWeight: '700',
    });
  });

  it('ignores a value the recipe does not have', () => {
    const picks = { tone: 'magic' } as unknown as { tone: 'brand' };
    assert.deepEqual(resolveRecipe(recipe(), picks), {
      root: { flexDirection: 'row', borderRadius: 4, height: 32 },
      label: { fontSize: 13 },
    });
  });

  it('returns the same objects for the same selection', () => {
    const compiled = recipe();
    const first = resolveRecipe(compiled, { tone: 'brand' });
    assert.equal(resolveRecipe(compiled, { tone: 'brand', size: 'small' }), first);
    assert.notEqual(resolveRecipe(compiled, { tone: 'critical' }), first);
  });

  it('never mutates the definition', () => {
    const before = JSON.stringify(definition);
    resolveRecipe(recipe(), { tone: 'brand', size: 'large', selected: true, disabled: true });
    assert.equal(JSON.stringify(definition), before);
  });
});

describe('variantMapOf', () => {
  it('lists each variant’s values in order, with true and false as booleans', () => {
    assert.deepEqual(variantMapOf(definition), {
      tone: ['neutral', 'brand', 'critical'],
      size: ['small', 'large'],
      selected: [true, false],
      disabled: [true, false],
    });
  });
});
