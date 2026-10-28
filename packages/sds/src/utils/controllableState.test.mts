/**
 * Controlled and uncontrolled state: which value shows, what the component
 * keeps, and when the caller hears about a change.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isControlled,
  requestControllableChange,
  resolveControllable,
} from './controllableState.ts';

describe('isControlled', () => {
  it('is controlled by any value but undefined', () => {
    assert.equal(isControlled(undefined), false);
    for (const value of [false, true, '', 'a', 0, null]) {
      assert.equal(isControlled(value), true, String(value));
    }
  });
});

describe('resolveControllable', () => {
  it('shows the caller’s value when controlled, false included', () => {
    assert.equal(resolveControllable(false, true), false);
    assert.equal(resolveControllable('b', 'a'), 'b');
  });

  it('shows its own value when uncontrolled', () => {
    assert.equal(resolveControllable(undefined, true), true);
    assert.equal(resolveControllable<string | null>(undefined, null), null);
  });
});

describe('requestControllableChange', () => {
  it('keeps and reports a change when uncontrolled', () => {
    assert.deepEqual(requestControllableChange(undefined, false, true), { internal: true, notify: true });
  });

  it('keeps nothing but reports the request when controlled', () => {
    assert.deepEqual(requestControllableChange(false, false, true), { internal: false, notify: true });
    // The component's own value is stale while controlled, and stays so.
    assert.deepEqual(requestControllableChange(true, false, false), { internal: false, notify: true });
  });

  it('treats a request for the value already shown as no change', () => {
    assert.deepEqual(requestControllableChange(undefined, 'a', 'a'), { internal: 'a', notify: false });
    assert.deepEqual(requestControllableChange('a', 'b', 'a'), { internal: 'b', notify: false });
  });

  it('compares against what shows, not what the component kept', () => {
    // Controlled to 'a' with a stale 'b' kept: asking for 'b' is a change.
    assert.deepEqual(requestControllableChange('a', 'b', 'b'), { internal: 'b', notify: true });
  });
});
