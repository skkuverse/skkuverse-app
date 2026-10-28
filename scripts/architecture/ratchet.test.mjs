// The allowlist ratchet's comparison, on fixtures: an unchanged list passes,
// a shrink with the fix passes, and a new violation, a stale entry, a grown
// list and an entry for an added file each fail.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareAllowlist, pathOf } from './ratchet.mjs';

const basePaths = new Set(['a.ts', 'b.ts', 'c.ts']);

function run(overrides) {
  return compareAllowlist({
    rule: 'demo',
    violations: ['a.ts', 'b.ts'],
    allowlist: ['a.ts', 'b.ts'],
    baseList: ['a.ts', 'b.ts'],
    basePaths,
    ...overrides,
  });
}

test('an unchanged list passes', () => {
  // Act
  const { errors } = run({});

  // Assert
  assert.deepEqual(errors, []);
});

test('a fix that shrinks the list in the same change passes', () => {
  // Act
  const { errors, regenerated } = run({ violations: ['a.ts'], allowlist: ['a.ts'] });

  // Assert
  assert.deepEqual(errors, []);
  assert.deepEqual(regenerated, ['a.ts']);
});

test('a new violation fails and names the key', () => {
  // Act
  const { errors } = run({ violations: ['a.ts', 'b.ts', 'c.ts'] });

  // Assert
  assert.deepEqual(errors, ['demo: c.ts']);
});

test('a fixed file left on the list fails', () => {
  // Act
  const { errors, regenerated } = run({ violations: ['a.ts'] });

  // Assert
  assert.equal(errors.length, 1);
  assert.match(errors[0], /b\.ts is listed but no longer violates/);
  assert.deepEqual(regenerated, ['a.ts']);
});

test('an entry the base list did not hold fails', () => {
  // Act
  const { errors } = run({ violations: ['a.ts', 'b.ts', 'c.ts'], allowlist: ['a.ts', 'b.ts', 'c.ts'] });

  // Assert
  assert.equal(errors.length, 1);
  assert.match(errors[0], /c\.ts was added to the allowlist/);
});

test('seeding a list the base does not have passes', () => {
  // Act
  const { errors } = run({ baseList: null });

  // Assert
  assert.deepEqual(errors, []);
});

test('an entry for a file the change adds fails, even when seeding', () => {
  // Act
  const { errors } = run({ violations: ['a.ts', 'new.ts'], allowlist: ['a.ts', 'new.ts'], baseList: null });

  // Assert
  assert.equal(errors.length, 1);
  assert.match(errors[0], /new\.ts names a file this change adds/);
});

test('a key is matched by the path before its first space', () => {
  // Act
  const path = pathOf('apps/mobile/src/x.ts -> hooks');

  // Assert
  assert.equal(path, 'apps/mobile/src/x.ts');
});
