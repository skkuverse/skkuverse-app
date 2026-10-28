// The context every agent session carries stays short.
//
// The root CLAUDE.md loads in every session and .claude/rules/sds-ui.md in
// every session that reads UI code, so each line there is paid for again and
// again. The design-system section of CLAUDE.md is a pointer to the usage
// guide, and the rules file holds only the hard rules: the guide, SDS.md and
// the token files hold the detail and the values.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const SECTION_HEADING = '### Design System (`@skkuverse/sds`)';
const SECTION_LIMIT = 10;
const RULES_FILE = '.claude/rules/sds-ui.md';
const RULES_LIMIT = 30;

/**
 * The lines of the section under `heading`, up to the next heading of any
 * level, with the blank lines at either end trimmed. Null when the heading
 * is missing.
 */
export function sectionLines(markdown, heading) {
  const lines = markdown.split('\n');
  const start = lines.indexOf(heading);
  if (start === -1) return null;
  let end = lines.findIndex((line, index) => index > start && /^#{1,6} /.test(line));
  if (end === -1) end = lines.length;
  const body = lines.slice(start + 1, end);
  while (body.length > 0 && body[0].trim() === '') body.shift();
  while (body.length > 0 && body.at(-1).trim() === '') body.pop();
  return body;
}

/** A value a token file owns: a color, or a length or duration with its unit. */
const TOKEN_VALUE = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(|\b\d+(?:\.\d+)?\s?(?:px|pt|dp|ms)\b/i;

test('sectionLines stops at the next heading and trims blank ends', () => {
  const markdown = ['## A', '', 'one', '', 'two', '', '### B', 'three'].join('\n');
  assert.deepEqual(sectionLines(markdown, '## A'), ['one', '', 'two']);
  assert.equal(sectionLines(markdown, '## C'), null);
});

test(`the CLAUDE.md design-system section is a pointer of at most ${SECTION_LIMIT} lines`, () => {
  const body = sectionLines(read('CLAUDE.md'), SECTION_HEADING);
  assert.ok(body, `CLAUDE.md has no "${SECTION_HEADING}" heading`);
  assert.ok(
    body.length <= SECTION_LIMIT,
    `The CLAUDE.md design-system section is ${body.length} lines (limit ${SECTION_LIMIT}). ` +
      'Move the detail to docs/reference/design-usage.md or packages/sds/SDS.md and point at it.',
  );
});

test(`${RULES_FILE} is at most ${RULES_LIMIT} lines`, () => {
  const lines = read(RULES_FILE).replace(/\n$/, '').split('\n');
  assert.ok(
    lines.length <= RULES_LIMIT,
    `${RULES_FILE} is ${lines.length} lines (limit ${RULES_LIMIT}). Keep the hard rules; the guide holds the rest.`,
  );
});

test(`${RULES_FILE} carries no token values`, () => {
  const offending = read(RULES_FILE)
    .split('\n')
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => TOKEN_VALUE.test(line));
  assert.deepEqual(
    offending.map(({ number, line }) => `${number}: ${line}`),
    [],
    `${RULES_FILE} names a value; name the token instead, and let the token file hold the value`,
  );
});

test(`${RULES_FILE} loads for the UI code it governs`, () => {
  const frontmatter = read(RULES_FILE).match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(frontmatter, `${RULES_FILE} has no frontmatter, so it would load in every session`);
  for (const glob of ['apps/mobile/**/*.{ts,tsx}', 'packages/sds/src/**/*.{ts,tsx}']) {
    assert.ok(frontmatter[1].includes(`"${glob}"`), `${RULES_FILE} paths: is missing "${glob}"`);
  }
});
