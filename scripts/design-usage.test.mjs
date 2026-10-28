// Every usage rule an `sds/*` lint message cites resolves in the guide.
//
// Each message ends "See COLOR-01 in packages/sds/SDS.md "Lint rules"", and
// that table links the ID to its section in docs/reference/design-usage.md.
// A message that cites an ID the guide has no section for sends the reader,
// often an agent blocked by the gate, to nothing. The guide gives each rule an
// anchor `<a id="color-01"></a>`, the ID in lower case.
//
// The IDs are read from the source rather than from the loaded plugin's
// messages, because `sds/no-handbuilt-part` fills its ID in from a data table
// (`{{rule}}`), and the no-restricted-imports messages live in the config.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Where the cited IDs live: the plugin, the config's import bans, and the lint rules table. */
const SOURCES = ['scripts/eslint/plugin-sds.cjs', 'eslint.config.js', 'packages/sds/SDS.md'];
const GUIDE = 'docs/reference/design-usage.md';

/** A usage-rule ID: `COLOR-01`, `A11Y-08`, `CALLOUT-07`. */
const RULE_ID = /\b[A-Z][A-Z0-9]*-\d{2}\b/g;

/** The usage-rule IDs a text cites, sorted and deduplicated. */
export function citedIds(text) {
  return [...new Set(text.match(RULE_ID) ?? [])].sort();
}

/** The anchors a guide declares with `<a id="…">`. */
export function anchorsIn(guide) {
  return new Set([...guide.matchAll(/<a id="([^"]+)"><\/a>/g)].map((match) => match[1]));
}

/** The IDs among `ids` that have no anchor in `guide`. */
export function missingAnchors(ids, guide) {
  const anchors = anchorsIn(guide);
  return ids.filter((id) => !anchors.has(id.toLowerCase()));
}

const read = (path) => readFileSync(resolve(root, path), 'utf8');

test('reports a cited ID whose anchor is missing, by name', () => {
  const guide = '- <a id="color-01"></a>**COLOR-01** · Draw every color from a role.';
  assert.deepEqual(missingAnchors(['COLOR-01', 'COLOR-03'], guide), ['COLOR-03']);
});

test('reads IDs from messages and data tables alike', () => {
  const source = `see('COLOR-01'); { rule: 'CHIP-01' }; 'See RESULT-01 in packages/sds/SDS.md'`;
  assert.deepEqual(citedIds(source), ['CHIP-01', 'COLOR-01', 'RESULT-01']);
});

test('the lint messages cite usage rules at all', () => {
  // Guards the scan itself: an empty list would pass the test below vacuously.
  assert.ok(citedIds(read('scripts/eslint/plugin-sds.cjs')).length > 0);
});

test('every usage rule the sds lint messages cite has a section in the guide', () => {
  const guide = read(GUIDE);
  for (const source of SOURCES) {
    const missing = missingAnchors(citedIds(read(source)), guide);
    assert.deepEqual(
      missing,
      [],
      `${source} cites ${missing.join(', ')}, which ${GUIDE} has no section for. ` +
        `Add the rule there as \`<a id="${(missing[0] ?? '').toLowerCase()}"></a>**${missing[0] ?? ''}**\`, or cite an ID it has.`,
    );
  }
});

test('the guide declares each anchor once', () => {
  const ids = [...read(GUIDE).matchAll(/<a id="([^"]+)"><\/a>/g)].map((match) => match[1]);
  const repeated = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual(repeated, [], `${GUIDE} repeats the anchors ${repeated.join(', ')}`);
});
