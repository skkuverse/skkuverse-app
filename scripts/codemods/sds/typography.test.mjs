// K5's two codemods. typo-literal moves a font size in a WantedSans style to
// a step of the scale; txt-style-lift moves a Txt style's size and weight into
// its props. Neither changes a line height unless told to, and each reports
// what it leaves.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyEdits } from './codemod.mjs';
import { transform as lift } from './txt-style-lift.mjs';
import { makeTransform } from './typo-literal.mjs';

const FILE = 'apps/mobile/src/features/demo/Demo.tsx';
const run = (transform, text) => {
  const { edits, unresolved } = transform(FILE, text);
  return { out: applyEdits(text, edits), unresolved: unresolved.map((u) => u.reason) };
};

test('typo-literal: a size with the step\'s line height becomes the step, and the import is added', () => {
  const { out, unresolved } = run(
    makeTransform(),
    [
      "import { StyleSheet } from 'react-native';",
      "import { wantedSans } from '@skkuverse/shared';",
      'const styles = StyleSheet.create({',
      '  meta: {',
      '    fontSize: 13,',
      '    lineHeight: 19.5,',
      "    ...wantedSans('700'),",
      '  },',
      '});',
      '',
    ].join('\n'),
  );
  assert.deepEqual(unresolved, []);
  assert.match(out, /import \{ wantedSans, SdsTypeScale \} from '@skkuverse\/shared';/);
  assert.match(out, /meta: \{\n {4}\.\.\.SdsTypeScale\.t3,\n {4}\.\.\.wantedSans\('700'\),\n {2}\}/);
});

test('typo-literal: a step that would add a line height moves only when allowed, and says so', () => {
  const text = [
    "import { StyleSheet } from 'react-native';",
    "import { SdsTypeScale, wantedSans } from '@skkuverse/shared';",
    "const styles = StyleSheet.create({ detail: { fontSize: 11, ...wantedSans('400') } });",
    '',
  ].join('\n');
  const strict = run(makeTransform(), text);
  assert.equal(strict.out, text);
  assert.deepEqual(strict.unresolved, ['fontSize: 11: t1 adds a line height of 16.5 (--allow-added-line-height)']);
  const allowed = run(makeTransform({ allowAddedLineHeight: true }), text);
  assert.match(allowed.out, /detail: \{ \.\.\.SdsTypeScale\.t1, \.\.\.wantedSans\('400'\) \}/);
  assert.deepEqual(allowed.unresolved, ['moved; t1 adds a line height of 16.5: check this screen']);
});

test('typo-literal: the system font, another line height, an approximate size and a weight literal stay', () => {
  const text = [
    "import { StyleSheet } from 'react-native';",
    "import { wantedSans } from '@skkuverse/shared';",
    'const styles = StyleSheet.create({',
    '  a: { fontSize: 14 },',
    "  b: { fontSize: 14, lineHeight: 20, ...wantedSans('400') },",
    "  c: { fontSize: 10, ...wantedSans('400') },",
    "  d: { fontSize: 14, fontWeight: '700', ...wantedSans('400') },",
    '});',
    '',
  ].join('\n');
  const { out, unresolved } = run(makeTransform({ allowAddedLineHeight: true }), text);
  assert.equal(out, text);
  assert.equal(unresolved.length, 4);
  assert.match(unresolved[0], /no WantedSans family/);
  assert.match(unresolved[1], /lineHeight 20 is not t4's 21/);
  assert.match(unresolved[2], /t1 is not the same size/);
  assert.match(unresolved[3], /fontWeight literal/);
});

test('txt-style-lift: a size with the step\'s line height and an exact weight move into the Txt props', () => {
  const { out, unresolved } = run(
    lift,
    [
      "import { StyleSheet } from 'react-native';",
      "import { Txt } from '@skkuverse/sds';",
      'export function Demo() {',
      '  return <Txt typography="t7" style={styles.title}>x</Txt>;',
      '}',
      'const styles = StyleSheet.create({',
      '  title: {',
      '    fontSize: 14,',
      '    lineHeight: 21,',
      "    fontWeight: '700',",
      "    textAlign: 'center',",
      '  },',
      '});',
      '',
    ].join('\n'),
  );
  assert.deepEqual(unresolved, []);
  assert.match(out, /<Txt fontWeight="bold" typography="t4" style=\{styles\.title\}>/);
  assert.match(out, /title: \{\n {4}textAlign: 'center',\n {2}\}/);
});

test('txt-style-lift: a line height off the step, a conditional read and a read elsewhere stay', () => {
  const text = [
    "import { StyleSheet, View } from 'react-native';",
    "import { Txt } from '@skkuverse/sds';",
    'export function Demo({ on }: { on: boolean }) {',
    '  return (',
    '    <View style={styles.shared}>',
    '      <Txt style={styles.tight}>a</Txt>',
    '      <Txt style={[on && styles.maybe]}>b</Txt>',
    '      <Txt style={styles.shared}>c</Txt>',
    '    </View>',
    '  );',
    '}',
    'const styles = StyleSheet.create({',
    '  tight: { fontSize: 14, lineHeight: 20 },',
    "  maybe: { fontWeight: '700' },",
    "  shared: { fontWeight: '500' },",
    '});',
    '',
  ].join('\n');
  const { out, unresolved } = run(lift, text);
  assert.equal(out, text);
  assert.deepEqual(unresolved, [
    "styles.tight: lineHeight 20 is not t4's 21 (H3)",
    'styles.maybe: read conditionally',
    'styles.shared: read outside a Txt style',
  ]);
});
