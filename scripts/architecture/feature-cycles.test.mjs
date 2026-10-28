// No two features import each other (ADR 0020 D3: "No cycle between features is allowed").
// The graph is built from runtime imports between apps/mobile/src/features/* (a type-only
// import is erased at build and does not count); every feature in a strongly connected
// group of two or more is reported with the import that leads to the next one. Tests and
// fixtures are out of reach, as for the other structure rules. Today's violations are on
// allowlists/feature-cycles.json, which only shrinks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FEATURES, featureOf, resolveSpecifier, runtimeSpecifiers } from './imports.mjs';
import { isUncheckedSource, ratchetAllowlist, repoFiles, repoRoot } from './ratchet.mjs';

/**
 * The cycle keys for a set of files: `sources` maps a repository path to its text, and a
 * key reads `<importing file> imports <imported file> (cycle: a, b)`, one per feature in a cycle.
 */
export function featureCycles(sources) {
  const exists = (path) => sources.has(path);
  /** feature -> feature -> the first [from, to] import seen on that edge */
  const edges = new Map();
  for (const [path, source] of [...sources].sort(([a], [b]) => a.localeCompare(b))) {
    const from = featureOf(path);
    if (!from) continue;
    for (const specifier of runtimeSpecifiers(path, source)) {
      const target = resolveSpecifier(specifier, path, exists);
      const to = target && featureOf(target);
      if (!to || to === from) continue;
      const out = edges.get(from) ?? new Map();
      if (!out.has(to)) out.set(to, [path, target]);
      edges.set(from, out);
    }
  }

  // Tarjan's strongly connected components over the feature graph.
  let index = 0;
  const indexOf = new Map();
  const low = new Map();
  const stack = [];
  const onStack = new Set();
  const groups = [];
  const visit = (v) => {
    indexOf.set(v, index);
    low.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);
    for (const w of (edges.get(v) ?? new Map()).keys()) {
      if (!indexOf.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v), low.get(w)));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v), indexOf.get(w)));
      }
    }
    if (low.get(v) === indexOf.get(v)) {
      const group = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        group.push(w);
      } while (w !== v);
      if (group.length > 1) groups.push(group.sort());
    }
  };
  for (const feature of [...edges.keys()].sort()) if (!indexOf.has(feature)) visit(feature);

  const keys = [];
  for (const group of groups) {
    const members = new Set(group);
    for (const from of group) {
      for (const [to, [file, target]] of edges.get(from) ?? []) {
        if (members.has(to)) keys.push(`${file} imports ${target} (cycle: ${group.join(', ')})`);
      }
    }
  }
  return keys.sort();
}

test('featureCycles finds two features importing each other, and nothing else', () => {
  // Arrange
  const sources = new Map([
    ['apps/mobile/src/features/a/a.service.ts', "import { b } from '@/features/b/b.service';\nexport const a = b;\n"],
    ['apps/mobile/src/features/b/b.service.ts', "import { a } from '../a/a.service';\nexport const b = a;\n"],
    ['apps/mobile/src/features/c/c.service.ts', "import { a } from '@/features/a/a.service';\nexport const c = a;\n"],
  ]);

  // Act
  const keys = featureCycles(sources);

  // Assert
  assert.deepEqual(keys, [
    'apps/mobile/src/features/a/a.service.ts imports apps/mobile/src/features/b/b.service.ts (cycle: a, b)',
    'apps/mobile/src/features/b/b.service.ts imports apps/mobile/src/features/a/a.service.ts (cycle: a, b)',
  ]);
});

test('a type-only import does not close a cycle', () => {
  // Arrange
  const sources = new Map([
    ['apps/mobile/src/features/a/a.service.ts', "import { b } from '@/features/b/b.service';\nexport const a = b;\n"],
    ['apps/mobile/src/features/b/b.service.ts', "import type { A } from '../a/a.types';\nimport { type C } from '@/features/a/a.service';\nexport const b = 1;\n"],
    ['apps/mobile/src/features/a/a.types.ts', 'export type A = 1;\n'],
  ]);

  // Assert
  assert.deepEqual(featureCycles(sources), []);
});

test('no two features under apps/mobile/src import each other, or the cycle is allowlisted', () => {
  // Arrange
  const sources = new Map(
    repoFiles()
      .filter((path) => path.startsWith(FEATURES) && !isUncheckedSource(path))
      .filter((path) => existsSync(join(repoRoot, path)))
      .map((path) => [path, readFileSync(join(repoRoot, path), 'utf8')]),
  );

  // Act
  const errors = ratchetAllowlist('feature-cycles', featureCycles(sources));

  // Assert
  assert.deepEqual(errors, [], errors.join('\n'));
});
