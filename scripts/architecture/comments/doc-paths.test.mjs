import { test } from 'node:test';
import assert from 'node:assert/strict';
import { citedDocs, citedSections, docPathViolations, hasSection, headingsOf } from './doc-paths.mjs';

const FILE = 'apps/mobile/src/features/x/x.rules.ts';

test('reads the docs/ paths a comment cites, anchors dropped, and none from another repo', () => {
  // Act & Assert
  assert.deepEqual(citedDocs('// SEE: docs/decisions/0020-app-architecture.md.'), ['docs/decisions/0020-app-architecture.md']);
  assert.deepEqual(citedDocs('/** See docs/explanation/shared-map.md#the-host */'), ['docs/explanation/shared-map.md']);
  assert.deepEqual(citedDocs('// skkuverse-server/docs/x.md and shared-map.md'), []);
});

const SECTION_CASES = [
  ['// SEE: docs/explanation/shared-map.md (Caching): an ops change', 'Caching', false],
  ['/** SEE: docs/explanation/shared-map.md ("Campus shapes"): a layer */', 'Campus shapes', false],
  ['// SEE: docs/explanation/shared-map.md ("The v2 gate (redesigned 2026-05-01)")', 'The v2 gate (redesigned 2026-05-01)', false],
  ['// SEE: docs/explanation/shared-map.md ("A (b) c (d)"): why', 'A (b) c (d)', false],
  ['// field on buildings: docs/explanation/shared-map.md, "Campus shapes".', 'Campus shapes', false],
  ['// SEE: docs/explanation/shared-map.md §2 for each field', '2', false],
  ['/** See docs/explanation/shared-map.md#campus-shapes */', 'campus-shapes', true],
];

for (const [text, section, isAnchor] of SECTION_CASES) {
  test(`reads the section of ${JSON.stringify(text)}`, () => {
    // Act & Assert
    assert.deepEqual(citedSections(text), [{ doc: 'docs/explanation/shared-map.md', section, isAnchor }]);
  });
}

test('reads no section from a bare pointer or a path that is not a doc', () => {
  // Act & Assert
  assert.deepEqual(citedSections('// SEE: docs/decisions/0006-x.md: why the tiers. And apps/docs/x.md (Y).'), []);
});

test('reads a doc\'s headings, skipping fenced code', () => {
  // Arrange
  const markdown = ['# Title', '', '## Structure', '```bash', '# not a heading', '```', '### D1. Layers ##'].join('\n');

  // Act & Assert
  assert.deepEqual(headingsOf(markdown), ['Title', 'Structure', 'D1. Layers']);
});

const HEADINGS = ['Shared Map', 'Structure', 'D1. Layers: View → ViewModel', '2. `places` — one place', '5. Authoring', '5.1 The keys', '6.2 The window'];

for (const [label, section, found] of [
  ['the exact text, ignoring case', 'structure', true],
  ['a heading with code spans', '2. `places` — one place', true],
  ['a numbered id that opens a heading', 'D1', true],
  ['a section number', '2', true],
  ['a subsection number', '6.2', true],
  ['a section number whose subsections exist too', '5', true],
  ['a heading the doc lacks', 'Caching', false],
  ['a prefix that is not a numbered id', 'Shared', false],
  ['a section number with no heading of its own', '6', false],
  ['a subsection number that does not exist', '5.3', false],
]) {
  test(`${found ? 'finds' : 'misses'} ${label}`, () => {
    // Act & Assert
    assert.equal(hasSection(HEADINGS, { section, isAnchor: false }), found);
  });
}

test('matches an anchor against each heading\'s slug', () => {
  // Act & Assert
  assert.equal(hasSection(['Campus shapes', '6.2 The window'], { section: 'campus-shapes', isAnchor: true }), true);
  assert.equal(hasSection(['Campus shapes', '6.2 The window'], { section: '62-the-window', isAnchor: true }), true);
  assert.equal(hasSection(['Campus shapes'], { section: 'caching', isAnchor: true }), false);
});

test('flags a cited doc that does not exist, and a cited section its doc lacks', () => {
  // Arrange
  const docs = new Map([['docs/explanation/shared-map.md', '# Shared Map\n\n## The host\n']]);
  const ctx = { exists: (rel) => docs.has(rel), readDoc: (rel) => docs.get(rel) ?? null };
  const source = [
    '// SEE: docs/explanation/shared-map.md ("The host")',
    'const a = 1;',
    '// SEE: docs/explanation/shared-map.md ("The sheet")',
    'const b = 2;',
    '// SEE: docs/explanation/gone.md ("Anything")',
  ].join('\n');

  // Act & Assert
  assert.deepEqual(docPathViolations(FILE, source, ctx), [
    { line: 3, message: 'docs/explanation/shared-map.md has no section "The sheet"' },
    { line: 5, message: 'missing docs/explanation/gone.md' },
  ]);
});
