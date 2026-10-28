/**
 * The Button's tones and resting look.
 *
 * NOTE: packages/sds runs `node --test`, which cannot load @skkuverse/shared,
 * so the colors here are a stand-in that answers every token with its own
 * path ('bg.brandSolid'). The values themselves are pinned in
 * packages/shared/src/tokens/__tests__/semanticColors.test.ts. Spacing and
 * radius are the real scales: those two files import nothing, so they load
 * here as they are, and the sizes below are the numbers the Button drew
 * before it moved onto its recipe.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SemanticColors } from '@skkuverse/shared';
import { SdsRadius } from '../../../../shared/src/tokens/radius.ts';
import { SdsSpacing } from '../../../../shared/src/tokens/spacing.ts';
import { compileRecipe, resolveRecipe } from '../../core/recipe.ts';
import { buttonColors, buttonRecipe, buttonSurfaceToken } from './buttonRecipe.ts';

const byPath = (group: string) =>
  new Proxy({}, { get: (_target, name) => `${group}.${String(name)}` });

const color = { fg: byPath('fg'), bg: byPath('bg'), stroke: byPath('stroke') } as unknown as SemanticColors;

describe('buttonColors', () => {
  it('fills the brand button with the brand CTA', () => {
    assert.deepEqual(buttonColors('brand', color), {
      backgroundFillColor: 'bg.brandSolid',
      textFillColor: 'fg.onBrandSolid',
      pressedFillColor: 'bg.brandSolidPressed',
      loaderFillColor: 'fg.onBrandSolid',
      backgroundWeakColor: 'bg.neutralWeak',
      pressedWeakColor: 'bg.neutralWeakPressed',
      textWeakColor: 'fg.brandContrast',
      loaderWeakColor: 'fg.brandContrast',
    });
  });

  it('fills the critical button with critical', () => {
    const danger = buttonColors('critical', color);
    assert.equal(danger.backgroundFillColor, 'bg.criticalSolid');
    assert.equal(danger.textFillColor, 'fg.onCriticalSolid');
    assert.equal(danger.pressedFillColor, 'bg.criticalSolidPressed');
    assert.equal(danger.textWeakColor, 'fg.critical');
  });

  it('fills the neutral button with neutral solid', () => {
    const dark = buttonColors('neutral', color);
    assert.equal(dark.backgroundFillColor, 'bg.neutralSolid');
    assert.equal(dark.textFillColor, 'fg.onNeutralSolid');
    assert.equal(dark.pressedFillColor, 'bg.neutralSolidPressed');
    assert.equal(dark.textWeakColor, 'fg.neutralMuted');
  });

  // A press changes the surface only, so every pressed color is a bg token
  // and every label keeps its color.
  it('presses every tone onto a -pressed surface', () => {
    for (const tone of ['brand', 'critical', 'neutral'] as const) {
      const theme = buttonColors(tone, color);
      assert.match(theme.pressedFillColor, /^bg\.\w+Pressed$/, tone);
      assert.equal(theme.pressedWeakColor, 'bg.neutralWeakPressed', tone);
    }
  });
});

describe('buttonSurfaceToken', () => {
  it('names the surface a press recolors', () => {
    assert.equal(buttonSurfaceToken('brand', 'solid'), 'brandSolid');
    assert.equal(buttonSurfaceToken('critical', 'solid'), 'criticalSolid');
    assert.equal(buttonSurfaceToken('neutral', 'solid'), 'neutralSolid');
    for (const tone of ['brand', 'critical', 'neutral'] as const) {
      assert.equal(buttonSurfaceToken(tone, 'weak'), 'neutralWeak', tone);
    }
  });

  it('agrees with buttonColors on the surface', () => {
    for (const tone of ['brand', 'critical', 'neutral'] as const) {
      assert.equal(`bg.${buttonSurfaceToken(tone, 'solid')}`, buttonColors(tone, color).backgroundFillColor);
    }
  });
});

describe('buttonRecipe', () => {
  const compiled = compileRecipe(
    buttonRecipe({ scheme: 'light', color, spacing: SdsSpacing, radius: SdsRadius }),
  );
  const resolve = (selection: Record<string, string | boolean> = {}) =>
    resolveRecipe(compiled, selection as never);

  const absoluteFill = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 };
  const containerBase = { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' };

  it('draws the default button as it was drawn: brand, solid, large, inline', () => {
    assert.deepEqual(resolve(), {
      root: { alignSelf: 'flex-start' },
      container: {
        ...containerBase,
        paddingHorizontal: 28,
        paddingVertical: 2,
        minHeight: 56,
        minWidth: 96,
        borderRadius: 16,
      },
      surface: { ...absoluteFill, backgroundColor: 'bg.brandSolid' },
      content: { flexDirection: 'row', alignItems: 'center' },
      leftAccessory: { marginRight: 6 },
      label: { color: 'fg.onBrandSolid' },
      loading: { ...absoluteFill, justifyContent: 'center', alignItems: 'center' },
      dots: { flexDirection: 'row', gap: 7 },
      dot: { width: 8, height: 8, borderRadius: 9999, backgroundColor: 'fg.onBrandSolid' },
    });
  });

  // SEED's words by height, in order: TDS's tiny, medium, large and big.
  it('keeps every size as it was drawn', () => {
    const sizes = {
      xsmall: { paddingHorizontal: 10, paddingVertical: 2, minHeight: 32, minWidth: 52, borderRadius: 8 },
      small: { paddingHorizontal: 16, paddingVertical: 2, minHeight: 38, minWidth: 64, borderRadius: 10 },
      medium: { paddingHorizontal: 16, paddingVertical: 2, minHeight: 48, minWidth: 80, borderRadius: 14 },
      large: { paddingHorizontal: 28, paddingVertical: 2, minHeight: 56, minWidth: 96, borderRadius: 16 },
    };
    for (const [size, shape] of Object.entries(sizes)) {
      assert.deepEqual(resolve({ size }).container, { ...containerBase, ...shape }, size);
    }
  });

  it('lays out each display as it was', () => {
    assert.deepEqual(resolve({ display: 'block' }).root, {});
    assert.deepEqual(resolve({ display: 'full' }).root, {});
    assert.equal(resolve({ display: 'full' }).container.borderRadius, 0);
  });

  it('draws the weak variant as a neutral chip with the tone’s label', () => {
    const weak = resolve({ tone: 'critical', variant: 'weak' });
    assert.equal(weak.surface.backgroundColor, 'bg.neutralWeak');
    assert.equal(weak.label.color, 'fg.critical');
    assert.equal(weak.dot.backgroundColor, 'fg.critical');
  });

  it('draws a disabled button from the disabled roles in every tone and variant, with no opacity', () => {
    for (const tone of ['brand', 'critical', 'neutral'] as const) {
      for (const variant of ['solid', 'weak'] as const) {
        const disabled = resolve({ tone, variant, disabled: true });
        assert.equal(disabled.surface.backgroundColor, 'bg.disabled', `${tone} ${variant}`);
        assert.equal(disabled.label.color, 'fg.disabled', `${tone} ${variant}`);
        assert.equal(disabled.dot.backgroundColor, 'fg.disabled', `${tone} ${variant}`);
        assert.equal(disabled.container.opacity, undefined, `${tone} ${variant}`);
        assert.equal(disabled.content.opacity, undefined, `${tone} ${variant}`);
      }
    }
    assert.equal(resolve().container.opacity, undefined);
    assert.equal(resolve().content.opacity, undefined);
  });

  // Loading hides the content and keeps its width, so the dots never sit
  // over a label that shows through a translucent surface.
  it('hides the content while loading, disabled or not', () => {
    assert.equal(resolve({ loading: true }).content.opacity, 0);
    assert.equal(resolve({ variant: 'weak', disabled: true, loading: true }).content.opacity, 0);
    assert.equal(resolve({ tone: 'neutral', variant: 'weak', loading: true }).loading.backgroundColor, undefined);
  });
});
