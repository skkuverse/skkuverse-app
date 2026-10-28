// A confirm dialog closes only by its buttons unless the caller opts in; an
// alert keeps closing on a tap outside (DIALOG-03). The second half reads the
// component's source, so a Dialog part that stops asking this decision, or
// brings back a default of its own, fails here.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { closesOnDimmerTap } from './dimmer.ts';

describe('closesOnDimmerTap', () => {
  it('keeps a confirm open on a dimmer tap by default', () => {
    assert.equal(closesOnDimmerTap('confirm', undefined), false);
  });

  it('closes an alert on a dimmer tap by default', () => {
    assert.equal(closesOnDimmerTap('alert', undefined), true);
  });

  it('follows the caller when it says', () => {
    assert.equal(closesOnDimmerTap('confirm', true), true);
    assert.equal(closesOnDimmerTap('alert', false), false);
  });
});

describe('Dialog asks it per part', () => {
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'Dialog.tsx'), 'utf8');

  it('the alert asks as an alert and the confirm as a confirm', () => {
    assert.match(source, /function AlertDialog[\s\S]*closesOnDimmerTap\('alert', closeOnDimmerClick\)[\s\S]*function ConfirmDialog/);
    assert.match(source, /function ConfirmDialog[\s\S]*closesOnDimmerTap\('confirm', closeOnDimmerClick\)/);
  });

  it('no part sets a default of its own', () => {
    assert.doesNotMatch(source, /closeOnDimmerClick\s*=/);
  });
});
