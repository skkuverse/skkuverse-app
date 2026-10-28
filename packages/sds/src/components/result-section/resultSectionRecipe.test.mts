/**
 * The ResultSection's recipe: SEED's layout at each size, and its text
 * styles carried over by pixel size rather than by name (ADR 0012).
 *
 * NOTE: the colors are a stand-in that answers every token with its own path
 * ('fg.neutral'); the values are pinned in
 * packages/shared/src/tokens/__tests__/semanticColors.test.ts. Spacing,
 * radius and the type scale are the real ones.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SemanticColors } from '@skkuverse/shared';
import { SdsRadius } from '../../../../shared/src/tokens/radius.ts';
import { SdsSpacing } from '../../../../shared/src/tokens/spacing.ts';
import { compileRecipe, resolveRecipe, variantMapOf } from '../../core/recipe.ts';
import { RESULT_SECTION_PRIMARY, RESULT_SECTION_TEXT, resultSectionRecipe } from './resultSectionRecipe.ts';

const byPath = (group: string) =>
  new Proxy({}, { get: (_target, name) => `${group}.${String(name)}` });

const color = { fg: byPath('fg'), bg: byPath('bg'), stroke: byPath('stroke') } as unknown as SemanticColors;

const definition = resultSectionRecipe({ scheme: 'light', color, spacing: SdsSpacing, radius: SdsRadius });
const compiled = compileRecipe(definition);
const resolve = (selection: Record<string, string> = {}) => resolveRecipe(compiled, selection as never);

// SDS's type scale by pixel size (packages/shared/src/tokens/typography.ts),
// copied rather than imported: that module imports react-native.
const fontSize = { t4: 14, t6: 16, t10: 22 } as const;

describe('resultSectionRecipe', () => {
  it('lays out the large section as SEED does', () => {
    assert.deepEqual(resolve(), {
      root: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 48,
        paddingVertical: 16,
      },
      asset: { alignItems: 'center', paddingBottom: 16 },
      text: { alignItems: 'center', gap: 12, paddingBottom: 28 },
      title: { textAlign: 'center', color: 'fg.neutral' },
      description: { textAlign: 'center', color: 'fg.neutralMuted' },
      actions: { alignItems: 'center', gap: 20 },
      secondaryAction: {
        minHeight: 36,
        paddingHorizontal: 14,
        paddingVertical: 8,
        marginHorizontal: -14,
        marginVertical: -8,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
      },
      secondaryActionLabel: { color: 'fg.neutral' },
    });
  });

  it('tightens the text for the medium section', () => {
    assert.deepEqual(resolve({ size: 'medium' }).text, { alignItems: 'center', gap: 8, paddingBottom: 24 });
  });

  it('bleeds the secondary action by its own padding, so its label lines up', () => {
    const { secondaryAction } = resolve();
    assert.equal(Number(secondaryAction.marginHorizontal) + Number(secondaryAction.paddingHorizontal), 0);
    assert.equal(Number(secondaryAction.marginVertical) + Number(secondaryAction.paddingVertical), 0);
  });

  it('greys a disabled secondary action’s label, as SEED’s disabled ghost button', () => {
    assert.equal(resolve({ secondaryDisabled: true }).secondaryActionLabel.color, 'fg.disabled');
    assert.equal(resolve().secondaryActionLabel.color, 'fg.neutral');
  });

  it('lists its sizes for a catalog', () => {
    assert.deepEqual(variantMapOf(definition), { size: ['large', 'medium'], secondaryDisabled: [true, false] });
  });
});

describe('RESULT_SECTION_TEXT', () => {
  it('carries SEED’s text styles over by pixel size', () => {
    // SEED: large t8Bold (22px) / t5Regular (16px), medium t5Bold (16px) / t4Regular (14px).
    const { title, description } = RESULT_SECTION_TEXT;
    assert.equal(fontSize[title.large.typography], 22);
    assert.equal(fontSize[description.large.typography], 16);
    assert.equal(fontSize[title.medium.typography], 16);
    assert.equal(fontSize[description.medium.typography], 14);
  });

  it('sets the titles bold and the descriptions regular', () => {
    const { title, description, secondaryAction } = RESULT_SECTION_TEXT;
    assert.deepEqual(
      [title.large.fontWeight, title.medium.fontWeight, description.large.fontWeight, description.medium.fontWeight],
      ['bold', 'bold', 'regular', 'regular'],
    );
    assert.deepEqual(secondaryAction, { typography: 't4', fontWeight: 'bold' });
  });
});

describe('RESULT_SECTION_PRIMARY', () => {
  it('draws SEED’s neutral weak primary by default, and the brand fill for a core way on', () => {
    assert.deepEqual(RESULT_SECTION_PRIMARY, {
      neutral: { tone: 'neutral', variant: 'weak' },
      brand: { tone: 'brand', variant: 'solid' },
    });
  });
});
