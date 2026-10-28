/**
 * The Chip's behaviour: what each part announces, which press feedback it
 * gives, and how a toggle and a radio group move, controlled or not. The
 * state moves through `requestControllableChange`, which `Chip.Toggle` and
 * `Chip.RadioRoot` call through `useControllableState`.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { requestControllableChange, resolveControllable } from '../../utils/controllableState.ts';
import {
  chipAccessibility,
  chipFeedback,
  isRadioItemSelected,
  togglePressed,
} from './chipState.ts';

describe('chipAccessibility', () => {
  it('announces a button with no selection', () => {
    assert.deepEqual(chipAccessibility('button', { selected: false, disabled: false }), {
      role: 'button',
      state: { disabled: false },
    });
  });

  it('announces a toggle as checked or not', () => {
    assert.deepEqual(chipAccessibility('toggle', { selected: true, disabled: false }), {
      role: 'togglebutton',
      state: { checked: true, disabled: false },
    });
    assert.deepEqual(chipAccessibility('toggle', { selected: false, disabled: true }), {
      role: 'togglebutton',
      state: { checked: false, disabled: true },
    });
  });

  it('announces a radio item as checked or not', () => {
    assert.deepEqual(chipAccessibility('radio', { selected: true, disabled: false }), {
      role: 'radio',
      state: { checked: true, disabled: false },
    });
    assert.deepEqual(chipAccessibility('radio', { selected: false, disabled: false }), {
      role: 'radio',
      state: { checked: false, disabled: false },
    });
  });

  it('never reports `selected`, which Android reads as not checked on these roles', () => {
    for (const kind of ['button', 'toggle', 'radio'] as const) {
      for (const selected of [true, false]) {
        assert.equal('selected' in chipAccessibility(kind, { selected, disabled: false }).state, false);
      }
    }
  });
});

describe('chipFeedback', () => {
  it('only shrinks a selected chip, whose fill already shows its state', () => {
    assert.equal(chipFeedback(true), 'scale');
  });

  it('changes the surface and shrinks a chip at rest', () => {
    assert.equal(chipFeedback(false), 'both');
  });
});

describe('Chip.Toggle state', () => {
  const press = (checked: boolean | undefined, internal: boolean) =>
    requestControllableChange(checked, internal, togglePressed(resolveControllable(checked, internal)));

  it('flips and reports itself when uncontrolled', () => {
    assert.deepEqual(press(undefined, false), { internal: true, notify: true });
    assert.deepEqual(press(undefined, true), { internal: false, notify: true });
  });

  it('reports the flip and waits for the caller when controlled', () => {
    assert.deepEqual(press(false, false), { internal: false, notify: true });
    assert.equal(resolveControllable(false, press(false, false).internal), false);
    assert.deepEqual(press(true, false), { internal: false, notify: true });
  });
});

describe('Chip.RadioItem state', () => {
  const press = (value: string | undefined, internal: string | null, item: string) =>
    requestControllableChange<string | null>(value, internal, item);

  it('selects the pressed item when uncontrolled', () => {
    assert.deepEqual(press(undefined, 'a', 'b'), { internal: 'b', notify: true });
    assert.deepEqual(press(undefined, null, 'a'), { internal: 'a', notify: true });
  });

  it('reports the pressed item and waits for the caller when controlled', () => {
    assert.deepEqual(press('a', null, 'b'), { internal: null, notify: true });
    assert.equal(resolveControllable<string | null>('a', null), 'a');
  });

  it('does nothing when the selected item is pressed again', () => {
    assert.deepEqual(press(undefined, 'a', 'a'), { internal: 'a', notify: false });
    assert.deepEqual(press('a', null, 'a'), { internal: null, notify: false });
  });

  it('marks the group’s value as the selected item', () => {
    assert.equal(isRadioItemSelected('a', 'a'), true);
    assert.equal(isRadioItemSelected('a', 'b'), false);
    assert.equal(isRadioItemSelected(null, 'a'), false);
  });
});
