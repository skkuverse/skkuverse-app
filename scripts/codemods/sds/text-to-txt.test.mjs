// V4's Text-to-Txt codemod: a Text whose style resolves to a step becomes a
// Txt with the step and weight as props, and every Text it cannot move is
// reported and left alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyEdits } from './codemod.mjs';
import { transform } from './text-to-txt.mjs';

const FILE = 'apps/mobile/src/features/demo/Demo.tsx';
const run = (text, file = FILE) => {
  const { edits, unresolved } = transform(file, text);
  return { out: applyEdits(text, edits), unresolved };
};

test('a sheet entry and an inline size become props; emptied entries go; the imports follow', () => {
  const { out, unresolved } = run(
    [
      "import { StyleSheet, Text, View } from 'react-native';",
      "import { SdsTypo, wantedSans } from '@skkuverse/shared';",
      'export function Demo() {',
      '  return (',
      '    <View>',
      '      <Text style={styles.title}>a</Text>',
      '      <Text style={[styles.label, styles.box]}>b</Text>',
      '      <Text style={{ fontSize: 10, color: "red" }}>c</Text>',
      '    </View>',
      '  );',
      '}',
      'const styles = StyleSheet.create({',
      "  title: { fontSize: 15, fontWeight: '600', color: 'red' },",
      "  label: { ...SdsTypo.t5Regular, ...wantedSans('700') },",
      '  box: { marginTop: 4 },',
      '});',
      '',
    ].join('\n'),
  );
  assert.deepEqual(unresolved, []);
  assert.equal(
    out,
    [
      "import { StyleSheet, View } from 'react-native';",
      "import { Txt } from '@skkuverse/sds';",
      'export function Demo() {',
      '  return (',
      '    <View>',
      '      <Txt typography="t5" fontWeight="semibold" style={styles.title}>a</Txt>',
      '      <Txt typography="t5" fontWeight="bold" style={styles.box}>b</Txt>',
      '      <Txt typography="t1" style={{ color: "red" }}>c</Txt>',
      '    </View>',
      '  );',
      '}',
      'const styles = StyleSheet.create({',
      "  title: { color: 'red' },",
      '  box: { marginTop: 4 },',
      '});',
      '',
    ].join('\n'),
  );
});

test('spans, off-scale sizes, other line heights, letter spacing and shared entries are left', () => {
  const text = [
    "import { StyleSheet, Text, View } from 'react-native';",
    'export function Demo() {',
    '  return (',
    '    <View style={styles.a}>',
    '      <Text style={styles.a}>x<Text style={styles.b}>y</Text></Text>',
    '      <Text style={styles.c}>z</Text>',
    '      <Text style={styles.d}>w</Text>',
    '      <Text style={styles.e}>v</Text>',
    '      <Text>u</Text>',
    '    </View>',
    '  );',
    '}',
    'const styles = StyleSheet.create({',
    '  a: { fontSize: 14 },',
    '  b: { fontSize: 14 },',
    '  c: { fontSize: 9 },',
    '  d: { fontSize: 14, lineHeight: 20 },',
    '  e: { fontSize: 14, letterSpacing: -0.2 },',
    '});',
    '',
  ].join('\n');
  const { out, unresolved } = run(text);
  assert.equal(out, text);
  assert.deepEqual(
    unresolved.map((u) => u.reason),
    [
      '<Text>: a span inside another Text inherits its type',
      '<Text>: font size 9 is off the scale (H3)',
      "<Text>: line height 20 is not t4's 21 (H3)",
      '<Text>: letterSpacing',
      '<Text>: no style, so no size',
      '<Text>: its style entry styles.a is read by something else',
    ],
  );
});

test('SDS itself and the error boundary are left', () => {
  const text = "import { Text } from 'react-native';\nexport const A = () => <Text style={{ fontSize: 14 }}>a</Text>;\n";
  assert.equal(run(text, 'packages/sds/src/components/txt/Txt.tsx').out, text);
  assert.equal(run(text, 'apps/mobile/src/bootstrap/ErrorBoundary.tsx').out, text);
});

test('a one-line entry keeps its color and loses the comma its last type key leaves', () => {
  const { out } = run(
    [
      "import { StyleSheet, Text } from 'react-native';",
      "import { Txt } from '@skkuverse/sds';",
      'export const A = () => <Text style={styles.a}>a</Text>;',
      "const styles = StyleSheet.create({ a: { color: '#000', fontSize: 16, fontWeight: '700' } });",
      '',
    ].join('\n'),
  );
  assert.match(out, /<Txt typography="t6" fontWeight="bold" style=\{styles\.a\}>a<\/Txt>/);
  assert.match(out, /a: \{ color: '#000' \}/);
  assert.doesNotMatch(out, /\bText\b/);
});
