/**
 * The Callout's recipe: SEED's shape, each tone on its weak surface with its
 * contrast text, and the role table Pressable reads.
 *
 * NOTE: the colors are a stand-in that answers every token with its own path
 * ('bg.neutralWeak'); the values are pinned in
 * packages/shared/src/tokens/__tests__/semanticColors.test.ts. Spacing and
 * radius are the real scales.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SemanticColors } from '@skkuverse/shared';
import { SdsRadius } from '../../../../shared/src/tokens/radius.ts';
import { SdsSpacing } from '../../../../shared/src/tokens/spacing.ts';
import { compileRecipe, resolveRecipe, variantMapOf } from '../../core/recipe.ts';
import { CALLOUT_ROLES, CALLOUT_TEXT, calloutRecipe } from './calloutRecipe.ts';

const byPath = (group: string) =>
  new Proxy({}, { get: (_target, name) => `${group}.${String(name)}` });

const color = { fg: byPath('fg'), bg: byPath('bg'), stroke: byPath('stroke') } as unknown as SemanticColors;

const definition = calloutRecipe({ scheme: 'light', color, spacing: SdsSpacing, radius: SdsRadius });
const compiled = compileRecipe(definition);
const resolve = (selection: Record<string, string> = {}) => resolveRecipe(compiled, selection as never);

const icon = { width: 16, height: 16, flexShrink: 0, alignItems: 'center', justifyContent: 'center' };

describe('calloutRecipe', () => {
  it('draws the default callout in SEED’s shape, neutral', () => {
    const text = { color: 'fg.neutral' };
    assert.deepEqual(resolve(), {
      root: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 50,
        paddingHorizontal: 14,
        paddingVertical: 14,
        gap: 12,
        borderRadius: 10,
        backgroundColor: 'bg.neutralWeak',
      },
      content: { flex: 1, ...text },
      title: text,
      description: text,
      link: { textDecorationLine: 'underline', ...text },
      prefixIcon: icon,
      suffixIcon: icon,
      closeButton: {
        width: 40,
        height: 40,
        margin: -12,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
      },
    });
  });

  it('puts each tone on its weak surface under its contrast text', () => {
    const expected = {
      neutral: ['bg.neutralWeak', 'fg.neutral'],
      informative: ['bg.informativeWeak', 'fg.informativeContrast'],
      positive: ['bg.positiveWeak', 'fg.positiveContrast'],
      warning: ['bg.warningWeak', 'fg.warningContrast'],
      critical: ['bg.criticalWeak', 'fg.criticalContrast'],
      brand: ['bg.brandWeak', 'fg.brandContrast'],
      // What a model wrote: fg.ai holds body contrast on bg.aiWeak by itself.
      ai: ['bg.aiWeak', 'fg.ai'],
    };
    for (const [tone, [surface, text]] of Object.entries(expected)) {
      const styles = resolve({ tone });
      assert.equal(styles.root.backgroundColor, surface, tone);
      for (const slot of ['content', 'title', 'description', 'link'] as const) {
        assert.equal(styles[slot].color, text, `${tone} ${slot}`);
      }
    }
  });

  it('draws the surface Pressable presses, for every tone', () => {
    for (const [tone, roles] of Object.entries(CALLOUT_ROLES)) {
      assert.equal(resolve({ tone }).root.backgroundColor, `bg.${roles.surface}`, tone);
    }
  });

  it('bleeds the close button into the padding so its icon sits where the padding ends', () => {
    const { root, closeButton } = resolve();
    const iconInset = Number(closeButton.margin) + (Number(closeButton.width) - icon.width) / 2;
    assert.equal(iconInset, 0);
    assert.equal(root.paddingHorizontal, 14);
  });

  it('draws SEED’s magic tone flat as ai, and has no pressed variant', () => {
    assert.deepEqual(variantMapOf(definition), {
      tone: ['neutral', 'informative', 'positive', 'warning', 'critical', 'brand', 'ai'],
    });
  });

  it('runs the paragraph in t4, the title bold', () => {
    assert.deepEqual(CALLOUT_TEXT, {
      title: { typography: 't4', fontWeight: 'bold' },
      description: { typography: 't4', fontWeight: 'regular' },
      link: { typography: 't4', fontWeight: 'regular' },
    });
  });
});
