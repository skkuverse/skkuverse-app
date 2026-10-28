/**
 * The Chip's recipe: every size, both variants at rest and selected in each
 * tone, disabled, and the surface table Pressable reads.
 *
 * NOTE: packages/sds runs `node --test`, which cannot load @skkuverse/shared,
 * so the colors here are a stand-in that answers every token with its own
 * path ('bg.neutralWeak'). The values themselves are pinned in
 * packages/shared/src/tokens/__tests__/semanticColors.test.ts. Spacing and
 * radius are the real scales: those two files import nothing.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SemanticColors } from '@skkuverse/shared';
import { SdsRadius } from '../../../../shared/src/tokens/radius.ts';
import { SdsSpacing } from '../../../../shared/src/tokens/spacing.ts';
import { compileRecipe, resolveRecipe, variantMapOf } from '../../core/recipe.ts';
import { CHIP_LABEL_TEXT, CHIP_SURFACE, chipRecipe, chipSurface } from './chipRecipe.ts';

const byPath = (group: string) =>
  new Proxy({}, { get: (_target, name) => `${group}.${String(name)}` });

const color = { fg: byPath('fg'), bg: byPath('bg'), stroke: byPath('stroke') } as unknown as SemanticColors;

const definition = chipRecipe({ scheme: 'light', color, spacing: SdsSpacing, radius: SdsRadius });
const compiled = compileRecipe(definition);
const resolve = (selection: Record<string, string | boolean> = {}) =>
  resolveRecipe(compiled, selection as never);

const rootBase = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  borderRadius: 9999,
};

describe('chipRecipe', () => {
  it('draws the default chip: solid, neutral, medium, at rest', () => {
    assert.deepEqual(resolve(), {
      root: { ...rootBase, backgroundColor: 'bg.neutralWeak', height: 36, minWidth: 48, paddingHorizontal: 8 },
      label: { paddingHorizontal: 6, flexShrink: 1, color: 'fg.neutral' },
      prefixIcon: { alignItems: 'center', justifyContent: 'center', marginLeft: 6, width: 16, height: 16 },
      suffixIcon: { alignItems: 'center', justifyContent: 'center', marginRight: 6, width: 14, height: 14 },
    });
  });

  it('takes SEED’s height, minimum width, padding and icon sizes at each size', () => {
    const sizes = {
      small: { root: [32, 44, 6], prefix: 14, suffix: 14 },
      medium: { root: [36, 48, 8], prefix: 16, suffix: 14 },
      large: { root: [40, 52, 10], prefix: 16, suffix: 16 },
    };
    for (const [size, { root, prefix, suffix }] of Object.entries(sizes)) {
      const styles = resolve({ size });
      const [height, minWidth, paddingHorizontal] = root;
      assert.deepEqual(
        [styles.root.height, styles.root.minWidth, styles.root.paddingHorizontal],
        [height, minWidth, paddingHorizontal],
        size,
      );
      assert.equal(styles.prefixIcon.width, prefix, size);
      assert.equal(styles.prefixIcon.height, prefix, size);
      assert.equal(styles.suffixIcon.width, suffix, size);
    }
  });

  it('keeps the inset to the label at SEED’s, padding plus the label’s own', () => {
    // small 6+6, medium 8+6, large 10+6.
    const insets = { small: 12, medium: 14, large: 16 };
    for (const [size, inset] of Object.entries(insets)) {
      const styles = resolve({ size });
      assert.equal(Number(styles.root.paddingHorizontal) + Number(styles.label.paddingHorizontal), inset, size);
    }
  });

  it('draws outlineWeak at rest as a transparent pill with a muted outline', () => {
    const styles = resolve({ variant: 'outlineWeak' });
    assert.equal(styles.root.backgroundColor, 'bg.transparent');
    assert.equal(styles.root.borderWidth, 1);
    assert.equal(styles.root.borderColor, 'stroke.neutralMuted');
    assert.equal(styles.label.color, 'fg.neutral');
  });

  it('leaves a chip at rest neutral in both tones', () => {
    for (const variant of ['solid', 'outlineWeak']) {
      assert.deepEqual(resolve({ variant, tone: 'brand' }), resolve({ variant, tone: 'neutral' }), variant);
    }
  });

  it('fills a selected solid chip with the tone’s solid role', () => {
    const neutral = resolve({ selected: true });
    assert.equal(neutral.root.backgroundColor, 'bg.neutralSolid');
    assert.equal(neutral.label.color, 'fg.onNeutralSolid');

    const brand = resolve({ selected: true, tone: 'brand' });
    assert.equal(brand.root.backgroundColor, 'bg.brandSolid');
    assert.equal(brand.label.color, 'fg.onBrandSolid');
    assert.equal(brand.root.borderWidth, undefined);
  });

  it('gives a selected outlineWeak chip a weak fill and a strong outline in its tone', () => {
    const neutral = resolve({ variant: 'outlineWeak', selected: true });
    assert.equal(neutral.root.backgroundColor, 'bg.neutralWeak');
    assert.equal(neutral.root.borderColor, 'stroke.neutralContrast');
    assert.equal(neutral.root.borderWidth, 1);
    assert.equal(neutral.label.color, 'fg.neutral');

    const brand = resolve({ variant: 'outlineWeak', selected: true, tone: 'brand' });
    assert.equal(brand.root.backgroundColor, 'bg.brandWeak');
    assert.equal(brand.root.borderColor, 'stroke.brandSolid');
    assert.equal(brand.label.color, 'fg.brandContrast');
  });

  it('draws a disabled chip from the disabled roles, selected or not, with no opacity', () => {
    for (const variant of ['solid', 'outlineWeak'] as const) {
      for (const tone of ['neutral', 'brand'] as const) {
        for (const selected of [true, false]) {
          const disabled = resolve({ variant, tone, selected, disabled: true });
          const at = `${variant} ${tone} selected=${selected}`;
          assert.equal(disabled.root.backgroundColor, 'bg.disabled', at);
          assert.equal(disabled.label.color, 'fg.disabled', at);
          assert.equal(disabled.root.opacity, undefined, at);
          if (variant === 'outlineWeak') assert.equal(disabled.root.borderColor, 'stroke.neutralMuted', at);
        }
      }
    }
    assert.equal(resolve().root.opacity, undefined);
  });

  it('has no pressed variant: the press is the hook’s', () => {
    assert.equal('pressed' in definition.variants, false);
  });

  it('lists its variants for a catalog', () => {
    assert.deepEqual(variantMapOf(definition), {
      variant: ['solid', 'outlineWeak'],
      tone: ['neutral', 'brand'],
      size: ['small', 'medium', 'large'],
      selected: [true, false],
      disabled: [true, false],
    });
  });

  it('draws the label in SEED’s t4 medium', () => {
    assert.deepEqual(CHIP_LABEL_TEXT, { typography: 't4', fontWeight: 'medium' });
  });
});

describe('chipSurface', () => {
  it('agrees with the recipe’s fill in every state, so Pressable presses what is drawn', () => {
    for (const variant of ['solid', 'outlineWeak'] as const) {
      for (const tone of ['neutral', 'brand'] as const) {
        for (const selected of [true, false]) {
          assert.equal(
            `bg.${chipSurface(variant, tone, selected)}`,
            resolve({ variant, tone, selected }).root.backgroundColor,
            `${variant} ${tone} ${selected}`,
          );
        }
      }
    }
  });

  it('rests on the table’s surface whatever the tone', () => {
    assert.equal(chipSurface('solid', 'brand', false), CHIP_SURFACE.solid.rest);
    assert.equal(chipSurface('outlineWeak', 'brand', false), CHIP_SURFACE.outlineWeak.rest);
  });

  it('rests a solid chip on the glass control fill inside a glass sheet, and keeps a selected tone', () => {
    assert.equal(chipSurface('solid', 'neutral', false, 'glass'), 'glassControl');
    assert.equal(chipSurface('solid', 'brand', true, 'glass'), CHIP_SURFACE.solid.brand);
    assert.equal(chipSurface('outlineWeak', 'neutral', false, 'glass'), CHIP_SURFACE.outlineWeak.rest);
    assert.equal(chipSurface('solid', 'neutral', false, 'opaque'), CHIP_SURFACE.solid.rest);
  });
});
