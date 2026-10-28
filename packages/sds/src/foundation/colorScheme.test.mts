/**
 * Color scheme policy resolution.
 *
 * NOTE: packages/sds runs `node --test`, a different runner from
 * packages/shared's vitest. `colorScheme.ts` imports types only, so it loads
 * under plain Node.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_COLOR_MODE, resolveColorScheme } from './colorScheme.ts';

const SYSTEM = ['light', 'dark', 'unspecified', null, undefined] as const;

describe('resolveColorScheme', () => {
  it('pins light whatever the OS says', () => {
    for (const system of SYSTEM) assert.equal(resolveColorScheme('light-only', system), 'light');
  });

  it('pins dark whatever the OS says', () => {
    for (const system of SYSTEM) assert.equal(resolveColorScheme('dark-only', system), 'dark');
  });

  it('follows the OS under system', () => {
    assert.equal(resolveColorScheme('system', 'light'), 'light');
    assert.equal(resolveColorScheme('system', 'dark'), 'dark');
  });

  it('reads no preference as light', () => {
    for (const system of ['unspecified', null, undefined] as const) {
      assert.equal(resolveColorScheme('system', system), 'light');
    }
  });
});

// Dark mode is not on: until it ships, the app renders light on every device.
describe('DEFAULT_COLOR_MODE', () => {
  it('renders light even when the OS reports dark', () => {
    assert.equal(resolveColorScheme(DEFAULT_COLOR_MODE, 'dark'), 'light');
  });
});
