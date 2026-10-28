// The check behind `yarn typecheck`, the mobile start/ios/android scripts, the
// release scripts and CI that every patch in patches/ is applied. Each fixture
// case builds a throwaway root holding one scoped package and its patch, and
// runs the script there as the CLI; the last case runs it on this tree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const script = join(repoRoot, 'scripts/check-patches.mjs');

const PATCH = `diff --git a/node_modules/@fx/lib/index.js b/node_modules/@fx/lib/index.js
index 0000001..0000002 100644
--- a/node_modules/@fx/lib/index.js
+++ b/node_modules/@fx/lib/index.js
@@ -1,3 +1,3 @@
 export const a = 1;
-export const b = 2;
+export const b = 'patched';
 export const c = 3;
`;
const PRISTINE = "export const a = 1;\nexport const b = 2;\nexport const c = 3;\n";
const PATCHED = "export const a = 1;\nexport const b = 'patched';\nexport const c = 3;\n";

function write(root, rel, text) {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
}

/** A root with @fx/lib at `installed` holding `source`, and its 1.0.0 patch. */
function fixture(t, { installed = '1.0.0', source = PRISTINE, install = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'check-patches-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  write(root, 'package.json', '{"name":"fx","private":true}\n');
  write(root, 'patches/@fx+lib+1.0.0.patch', PATCH);
  if (install) {
    write(root, 'node_modules/@fx/lib/package.json', JSON.stringify({ name: '@fx/lib', version: installed }));
    write(root, 'node_modules/@fx/lib/index.js', source);
  }
  return root;
}

function check(root, ...args) {
  const result = spawnSync('node', [script, '--root', root, ...args], { encoding: 'utf8' });
  return { status: result.status, out: result.stdout + result.stderr };
}

test('a patched package passes', (t) => {
  const { status, out } = check(fixture(t, { source: PATCHED }));
  assert.equal(status, 0, out);
  assert.match(out, /all 1 patches in patches\/ are applied/);
});

test('an unpatched package fails and names the fix command', (t) => {
  const { status, out } = check(fixture(t));
  assert.equal(status, 1, out);
  assert.match(out, /@fx\+lib\+1\.0\.0\.patch: not applied\. Fix: npx patch-package/);
});

test('a package changed some other way fails with the reinstall command', (t) => {
  const { status, out } = check(fixture(t, { source: 'export const b = 4;\n' }));
  assert.equal(status, 1, out);
  assert.match(out, /neither applied nor applicable.*rm -rf node_modules\/@fx\/lib && yarn install --frozen-lockfile/);
});

test('an installed version other than the patch file name fails, even when the hunks match', (t) => {
  const { status, out } = check(fixture(t, { installed: '1.0.1', source: PATCHED }));
  assert.equal(status, 1, out);
  assert.match(out, /installed 1\.0\.1, but the patch is for 1\.0\.0/);
});

test('a patched package that is not installed fails', (t) => {
  const { status, out } = check(fixture(t, { install: false }));
  assert.equal(status, 1, out);
  assert.match(out, /node_modules\/@fx\/lib is not installed/);
});

test('--fix applies an unpatched package with patch-package and then passes', (t) => {
  const root = fixture(t);
  mkdirSync(join(root, 'node_modules/.bin'));
  symlinkSync(join(repoRoot, 'node_modules/patch-package'), join(root, 'node_modules/patch-package'));
  symlinkSync('../patch-package/index.js', join(root, 'node_modules/.bin/patch-package'));
  const { status, out } = check(root, '--fix');
  assert.equal(status, 0, out);
  assert.equal(readFileSync(join(root, 'node_modules/@fx/lib/index.js'), 'utf8'), PATCHED);
});

test("every patch in this repo's patches/ is applied to its node_modules", () => {
  const { status, out } = check(repoRoot);
  assert.equal(status, 0, out);
});
