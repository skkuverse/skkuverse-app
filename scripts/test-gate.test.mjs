// The mapping behind `yarn test:gate`: which test suites own a set of edited
// paths. The Claude Code commit gate runs it with the paths a commit holds, so a
// path must reach exactly the suites that own it, each once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { suitesFor } from './test-gate.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** A throwaway repository root: `files` maps a relative path to its JSON. */
function fixture(t, files) {
  const root = mkdtempSync(join(tmpdir(), 'test-gate-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [path, json] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), JSON.stringify(json));
  }
  return root;
}

function workspaceRoot(t) {
  return fixture(t, {
    'package.json': { workspaces: ['apps/*', 'packages/*'], scripts: { 'test:repo': 'node --test' } },
    'apps/mobile/package.json': { name: 'mobile', scripts: { test: 'node --test' } },
    'packages/sds/package.json': { name: '@skkuverse/sds', scripts: { test: 'node --test' } },
    'packages/shared/package.json': { name: '@skkuverse/shared', scripts: { test: 'vitest run' } },
    'packages/bridge/package.json': { name: '@skkuverse/bridge', scripts: {} },
  });
}

const labels = (suites) => suites.map((suite) => suite.label);

test('a package file maps to its own workspace suite', (t) => {
  const root = workspaceRoot(t);
  assert.deepEqual(labels(suitesFor(['packages/sds/src/components/chip/Chip.tsx'], root)), ['@skkuverse/sds', 'comments']);
});

test('an apps/mobile file maps to the mobile workspace suite', (t) => {
  const root = workspaceRoot(t);
  assert.deepEqual(labels(suitesFor(['apps/mobile/app/games/[id]/index.tsx'], root)), ['mobile', 'comments']);
});

test('the suite command runs the workspace test script through yarn', (t) => {
  const root = workspaceRoot(t);
  assert.deepEqual(suitesFor(['packages/sds/src/index.ts'], root)[0].args, ['--silent', 'workspace', '@skkuverse/sds', 'test']);
});

test('several files in one workspace run its suite once', (t) => {
  const root = workspaceRoot(t);
  const paths = ['packages/sds/src/a.ts', 'packages/sds/src/b/c.tsx', 'packages/sds/SDS.md'];
  assert.deepEqual(labels(suitesFor(paths, root)), ['@skkuverse/sds', 'comments']);
});

test('files across workspaces run each owning suite once, in a stable order', (t) => {
  const root = workspaceRoot(t);
  const paths = ['scripts/x.mjs', 'packages/shared/src/a.ts', 'apps/mobile/src/b.ts', 'packages/sds/src/c.ts'];
  assert.deepEqual(labels(suitesFor(paths, root)), ['mobile', '@skkuverse/sds', '@skkuverse/shared', 'comments', 'test:repo']);
  assert.deepEqual(labels(suitesFor([...paths].reverse(), root)), labels(suitesFor(paths, root)));
});

test('a workspace without a test script maps to no suite of its own', (t) => {
  const root = workspaceRoot(t);
  assert.deepEqual(labels(suitesFor(['packages/bridge/src/index.ts'], root)), ['comments']);
});

test('the comment check runs on the edited sources in its scope, and on no other file', (t) => {
  const root = workspaceRoot(t);
  const paths = [
    'apps/mobile/src/features/map/map.rules.ts',
    'packages/sds/src/Chip.tsx',
    'apps/mobile/src/features/map/map.rules.test.ts',
    'apps/mobile/src/features/map/config.json',
    'apps/mobile/app.config.ts',
  ];
  assert.deepEqual(suitesFor(paths, root).find((suite) => suite.label === 'comments')?.args, [
    '--silent',
    'test:comments',
    'apps/mobile/src/features/map/map.rules.ts',
    'packages/sds/src/Chip.tsx',
  ]);
  assert.equal(labels(suitesFor(['apps/mobile/app.config.ts', 'apps/mobile/src/x.test.ts'], root)).includes('comments'), false);
});

test('an edited doc runs the comment check over the whole tree, since a comment may cite its headings', (t) => {
  const root = workspaceRoot(t);
  const expected = [{ label: 'comments', args: ['--silent', 'test:comments'] }];
  assert.deepEqual(suitesFor(['docs/explanation/shared-map.md'], root), expected);
  assert.deepEqual(
    suitesFor(['docs/explanation/shared-map.md', 'packages/bridge/src/index.ts'], root),
    expected,
  );
});

test('root scripts map to the repository script tests', (t) => {
  const root = workspaceRoot(t);
  const suites = suitesFor(['scripts/check-singletons.mjs', 'scripts/nested/x.test.mjs'], root);
  assert.deepEqual(labels(suites), ['test:repo']);
  assert.deepEqual(suites[0].args, ['--silent', 'test:repo']);
});

test('paths outside every workspace map to no suite', (t) => {
  const root = workspaceRoot(t);
  const paths = [
    'README.md',
    'package.json',
    'eslint.config.js',
    'LICENSE',
    'packages/missing/src/a.json',
    'apps',
    'packages/sds-notes.md',
  ];
  assert.deepEqual(suitesFor(paths, root), []);
});

test('absolute paths inside the root count, and paths outside it do not', (t) => {
  const root = workspaceRoot(t);
  assert.deepEqual(labels(suitesFor([join(root, 'packages/sds/src/a.ts'), './apps/mobile/src/b.ts'], root)), [
    'mobile',
    '@skkuverse/sds',
    'comments',
  ]);
  assert.deepEqual(suitesFor(['../elsewhere/packages/sds/src/a.ts', '/tmp/packages/sds/a.ts'], root), []);
});

test('in this repository, an SDS component maps to the SDS suite and the comment check', () => {
  assert.deepEqual(labels(suitesFor(['packages/sds/src/components/chip/Chip.tsx'], repoRoot)), ['@skkuverse/sds', 'comments']);
});
