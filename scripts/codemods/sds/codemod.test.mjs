// The codemod driver: a dry run writes nothing, --write applies the edits,
// and an excluded file is never handed to the transform.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { applyEdits, runCodemod } from './codemod.mjs';
import { excludeList } from './files.mjs';
import { repoRoot } from './tokens.mjs';

test('edits apply from the end, and overlapping edits throw', () => {
  assert.equal(applyEdits('abcdef', [{ start: 0, end: 1, text: 'A' }, { start: 4, end: 6, text: 'EF!' }]), 'AbcdEF!');
  assert.throws(() => applyEdits('abcdef', [{ start: 0, end: 3, text: '' }, { start: 2, end: 4, text: '' }]), /overlapping/);
});

function fixtureRepo() {
  const root = mkdtempSync(join(tmpdir(), 'sds-codemod-test-'));
  const put = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  put('scripts/codemods/sds/exclude.json', JSON.stringify({ files: [{ path: 'apps/mobile/src/Wip.tsx', reason: 'work in progress' }] }));
  put('apps/mobile/src/A.tsx', 'const s = { padding: 8, margin: 7 };\n');
  put('apps/mobile/src/Wip.tsx', 'const s = { padding: 8 };\n');
  return root;
}

// Rewrites an on-scale padding and reports an off-scale margin.
function transform(file, text, records) {
  const edits = [];
  const unresolved = [];
  for (const r of records.spacing) {
    if (r.value === 8) edits.push({ start: r.valueStart, end: r.valueEnd, text: 'SdsSpacing.x2' });
    else unresolved.push({ line: r.line, reason: `${r.prop}: ${r.value} is off the scale` });
  }
  return { edits, unresolved };
}

test('a dry run prints the diff and writes nothing; --write applies it; an excluded file is skipped', () => {
  const root = fixtureRepo();
  try {
    const files = ['apps/mobile/src/A.tsx', 'apps/mobile/src/Wip.tsx'];
    const logs = [];
    const dry = runCodemod({ name: 'demo', transform, argv: ['--allow-dirty', ...files], root, log: (s) => logs.push(s) });
    assert.deepEqual(dry.changed, [{ file: 'apps/mobile/src/A.tsx', edits: 1 }]);
    assert.deepEqual(dry.unresolved, [{ file: 'apps/mobile/src/A.tsx', line: 1, reason: 'margin: 7 is off the scale' }]);
    assert.deepEqual(dry.skipped, [{ path: 'apps/mobile/src/Wip.tsx', reason: 'exclude.json: work in progress' }]);
    assert.match(logs.join('\n'), /\+const s = \{ padding: SdsSpacing\.x2, margin: 7 \};/);
    assert.equal(readFileSync(join(root, files[0]), 'utf8'), 'const s = { padding: 8, margin: 7 };\n');

    runCodemod({ name: 'demo', transform, argv: ['--write', '--allow-dirty', ...files], root, log: () => {} });
    assert.equal(readFileSync(join(root, files[0]), 'utf8'), 'const s = { padding: SdsSpacing.x2, margin: 7 };\n');
    assert.equal(readFileSync(join(root, files[1]), 'utf8'), 'const s = { padding: 8 };\n');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the repository's exclude list names files that exist, each with a reason", () => {
  for (const { path, reason } of excludeList()) {
    assert.ok(existsSync(join(repoRoot, path)), `${path} is gone; drop it from exclude.json`);
    assert.ok(reason && reason.length >= 10, `${path} needs a reason`);
  }
});
