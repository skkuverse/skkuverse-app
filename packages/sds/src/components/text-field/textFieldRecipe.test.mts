/**
 * The TextField's recipe, after SEED's text-input: the insets are the ones
 * the field drew before it moved onto its recipe.
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
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEXT_FIELD_PLACEHOLDER, textFieldLabelFloats, textFieldRecipe } from './textFieldRecipe.ts';

const byPath = (group: string) =>
  new Proxy({}, { get: (_target, name) => `${group}.${String(name)}` });

const color = { fg: byPath('fg'), bg: byPath('bg'), stroke: byPath('stroke') } as unknown as SemanticColors;

const compiled = compileRecipe(textFieldRecipe({ scheme: 'light', color, spacing: SdsSpacing, radius: SdsRadius }));
const resolve = (selection: Record<string, string | boolean> = {}) =>
  resolveRecipe(compiled, selection as never);

describe('textFieldRecipe', () => {
  it('keeps the box: 1pt outline, 12 radius, 16 aside, 8 above and below', () => {
    const { container, labelContainer } = resolve({ variant: 'box' });
    assert.deepEqual(
      [container.borderWidth, container.borderRadius, container.paddingHorizontal, container.paddingTop, container.paddingBottom],
      [1, 12, 16, 8, 8],
    );
    assert.equal(container.minHeight, 56);
    assert.equal(labelContainer.left, 16);
  });

  it('keeps the line: a 1pt bottom edge, flush with the label', () => {
    const { container, labelContainer } = resolve({ variant: 'line' });
    assert.equal(container.borderBottomWidth, 1);
    assert.equal(container.paddingHorizontal, 0);
    assert.equal(labelContainer.left, 0);
  });

  it('colors the line and the label by state, an error over focus', () => {
    const rest = resolve();
    assert.equal(rest.container.borderColor, 'stroke.neutralWeak');
    assert.equal(rest.label.color, 'fg.neutralSubtle');
    const focused = resolve({ focused: true });
    assert.equal(focused.container.borderBottomColor, 'stroke.informativeSolid');
    assert.equal(focused.label.color, 'fg.informative');
    const invalid = resolve({ focused: true, invalid: true });
    assert.equal(invalid.container.borderColor, 'stroke.criticalSolid');
    assert.equal(invalid.label.color, 'fg.critical');
    assert.equal(invalid.help.color, 'fg.critical');
  });

  it('draws disabled as SEED does: disabled text, and the box on the disabled surface', () => {
    const box = resolve({ variant: 'box', disabled: true });
    for (const slot of ['label', 'input', 'prefix', 'suffix'] as const) {
      assert.equal(box[slot].color, 'fg.disabled', slot);
    }
    assert.equal(box.container.backgroundColor, 'bg.disabled');
    assert.equal(box.container.opacity, undefined);
    assert.equal(resolve({ variant: 'line', disabled: true }).container.backgroundColor, undefined);
    assert.deepEqual(TEXT_FIELD_PLACEHOLDER, { enabled: 'placeholder', disabled: 'disabled' });
  });

  it('keeps the small insets', () => {
    const styles = resolve();
    assert.equal(styles.inputWithLabel.marginTop, 14);
    assert.equal(styles.prefix.marginRight, 4);
    assert.equal(styles.suffix.marginLeft, 4);
    assert.equal(styles.clearButton.marginLeft, 8);
    assert.deepEqual([styles.helpContainer.marginTop, styles.helpContainer.paddingHorizontal], [6, 4]);
  });
});

describe('textFieldLabelFloats', () => {
  const idle = { focused: false, hasValue: false };

  it('keeps the label above an empty, unfocused field by default (FIELD-02)', () => {
    assert.equal(textFieldLabelFloats(undefined, idle), true);
    assert.equal(textFieldLabelFloats('sustain', idle), true);
  });

  it('lets an appear label rest inside the field until focus or a value', () => {
    assert.equal(textFieldLabelFloats('appear', idle), false);
    assert.equal(textFieldLabelFloats('appear', { focused: true, hasValue: false }), true);
    assert.equal(textFieldLabelFloats('appear', { focused: false, hasValue: true }), true);
  });

  it('is what TextField asks, with no default of its own', () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'TextField.tsx'), 'utf8');
    assert.match(source, /textFieldLabelFloats\(labelOption,/);
    assert.doesNotMatch(source, /labelOption\s*=/);
  });
});
