/**
 * The ListRow's recipe and text styles: the insets are the ones the ListRow
 * drew before it moved onto its recipe.
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
  LIST_ROW_ARROW,
  LIST_ROW_LEFT_TEXT,
  LIST_ROW_TEXTS,
  listRowRecipe,
  listRowVerticalPadding,
} from './listRowRecipe.ts';

const byPath = (group: string) =>
  new Proxy({}, { get: (_target, name) => `${group}.${String(name)}` });

const color = { fg: byPath('fg'), bg: byPath('bg'), stroke: byPath('stroke') } as unknown as SemanticColors;

const compiled = compileRecipe(listRowRecipe({ scheme: 'light', color, spacing: SdsSpacing, radius: SdsRadius }));
const resolve = (selection: Record<string, string | boolean> = {}) =>
  resolveRecipe(compiled, selection as never);

describe('listRowVerticalPadding', () => {
  it('reads the numbers and the words alike, medium otherwise', () => {
    assert.equal(listRowVerticalPadding(8), 'xsmall');
    assert.equal(listRowVerticalPadding('xsmall'), 'xsmall');
    assert.equal(listRowVerticalPadding(16), 'small');
    assert.equal(listRowVerticalPadding('large'), 'large');
    assert.equal(listRowVerticalPadding(32), 'large');
    assert.equal(listRowVerticalPadding(24), 'medium');
    assert.equal(listRowVerticalPadding(undefined), 'medium');
  });
});

describe('listRowRecipe', () => {
  it('insets the row 24 by 24 by default', () => {
    assert.deepEqual(resolve().container, {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 24,
    });
  });

  it('keeps each vertical padding and the zero horizontal one', () => {
    const drawn = { xsmall: 8, small: 16, medium: 24, large: 32 };
    for (const [verticalPadding, value] of Object.entries(drawn)) {
      assert.equal(resolve({ verticalPadding }).container.paddingVertical, value, verticalPadding);
    }
    assert.equal(resolve({ horizontalPadding: 'none' }).container.paddingHorizontal, 0);
  });

  it('spaces the slots 16 from the contents and the arrow 4 from the right slot', () => {
    const styles = resolve();
    assert.equal(styles.left.marginRight, 16);
    assert.equal(styles.right.marginLeft, 16);
    assert.equal(styles.arrow.marginLeft, 4);
    assert.equal(styles.line.marginTop, 2);
  });

  it('aligns the side slots per prop', () => {
    assert.equal(resolve({ leftAlignment: 'top' }).left.alignSelf, 'flex-start');
    assert.equal(resolve({ rightAlignment: 'center' }).right.alignSelf, 'center');
  });

  it('fades a disabled row at SEED’s disabled opacity, and only then', () => {
    assert.equal(resolve({ faded: true }).container.opacity, 0.5);
    assert.equal(resolve().container.opacity, undefined);
  });
});

describe('LIST_ROW_TEXTS', () => {
  it('keeps the TDS sizes and weights, every secondary line on the subtle role', () => {
    assert.deepEqual(LIST_ROW_TEXTS['2RowTypeA'], {
      top: { typography: 't7', fontWeight: 'regular', color: 'neutral' },
      bottom: { typography: 't5', fontWeight: 'regular', color: 'neutralSubtle' },
    });
    assert.deepEqual(LIST_ROW_TEXTS['2RowTypeE'].bottom, { typography: 't3', fontWeight: 'regular', color: 'neutralSubtle' });
    assert.deepEqual(LIST_ROW_TEXTS['3RowTypeC'].middle, { typography: 't5', fontWeight: 'regular', color: 'neutralSubtle' });
    assert.deepEqual(LIST_ROW_TEXTS['1RowTypeC'].top, { typography: 't5', fontWeight: 'regular', color: 'neutral' });
  });

  it('draws the left text and the arrow as before, on roles', () => {
    assert.deepEqual(LIST_ROW_LEFT_TEXT, { typography: 't5', fontWeight: 'regular', color: 'neutralSubtle', width: 80 });
    assert.deepEqual(LIST_ROW_ARROW, { size: 18, color: 'placeholder' });
  });
});
