// K4's StyleSheet-to-createThemedStyles codemod: a color sheet read only in
// components becomes a themed hook each of them calls, its exact colors
// become roles, and a sheet it cannot move is reported and left alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyEdits } from './codemod.mjs';
import { scanSource } from './scan.mjs';
import { transform } from './stylesheet-to-themed.mjs';

const FILE = 'apps/mobile/src/features/demo/Demo.tsx';
const run = (text, file = FILE) => {
  const { edits, unresolved } = transform(file, text, scanSource(file, text));
  return { out: applyEdits(text, edits), unresolved };
};

test('a sheet read in components becomes a themed hook; exact colors become roles; unused imports go', () => {
  const { out, unresolved } = run(
    [
      "import { useMemo } from 'react';",
      "import { StyleSheet, View } from 'react-native';",
      "import { SdsColors } from '@skkuverse/shared';",
      'export function Demo() {',
      '  const box = useMemo(() => [styles.box], []);',
      '  return <View style={box} />;',
      '}',
      'export function Other() {',
      '  return <View style={styles.line} />;',
      '}',
      'const styles = StyleSheet.create({',
      '  box: { borderColor: SdsColors.grey700 },',
      '  line: { height: 1, backgroundColor: SdsColors.grey900 },',
      '});',
      '',
    ].join('\n'),
  );
  assert.deepEqual(unresolved, []);
  assert.equal(
    out,
    [
      "import { useMemo } from 'react';",
      "import { View } from 'react-native';",
      "import { createThemedStyles } from '@skkuverse/sds';",
      'export function Demo() {',
      '  const styles = useStyles();',
      '  const box = useMemo(() => [styles.box], [styles]);',
      '  return <View style={box} />;',
      '}',
      'export function Other() {',
      '  const styles = useStyles();',
      '  return <View style={styles.line} />;',
      '}',
      'const useStyles = createThemedStyles(({ color }) => ({',
      '  box: { borderColor: color.stroke.neutralSolid },',
      '  line: { height: 1, backgroundColor: color.stroke.neutralContrast },',
      '}));',
      '',
    ].join('\n'),
  );
});

test('a sheet with no exact color yet takes a factory with no argument, and keeps its static reads', () => {
  const { out } = run(
    [
      "import { StyleSheet, Text } from 'react-native';",
      "import { SdsColors } from '@skkuverse/shared';",
      'export const Label = () => {',
      '  return <Text style={brandStyles.label} />;',
      '};',
      'const brandStyles = StyleSheet.create({ label: { color: SdsColors.grey500 } });',
      '',
    ].join('\n'),
  );
  assert.match(out, /const useBrandStyles = createThemedStyles\(\(\) => \(\{ label: \{ color: SdsColors\.grey500 \} \}\)\);/);
  assert.match(out, /const brandStyles = useBrandStyles\(\);/);
  assert.match(out, /import \{ SdsColors \} from '@skkuverse\/shared';/);
  assert.match(out, /import \{ Text \} from 'react-native';/);
});

test('an exported sheet, one read outside a component and one with no colors are left', () => {
  const text = [
    "import { StyleSheet, View } from 'react-native';",
    'export const shared = StyleSheet.create({ a: { color: "#000" } });',
    'const styles = StyleSheet.create({ a: { color: "#000" } });',
    'const plain = StyleSheet.create({ a: { flex: 1 } });',
    'function render() {',
    '  return <View style={[styles.a, plain.a]} />;',
    '}',
    '',
  ].join('\n');
  const { out, unresolved } = run(text);
  assert.equal(out, text);
  assert.deepEqual(
    unresolved.map((u) => u.reason),
    ['shared: exported', 'styles: read at line 6 in render'],
  );
});
