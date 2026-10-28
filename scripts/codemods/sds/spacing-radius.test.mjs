// K2's spacing and radius codemod: on-scale literals become their step, a
// screen-edge 20 becomes the gutter, a pill becomes `full`, and everything it
// cannot move unchanged is reported and left alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyEdits } from './codemod.mjs';
import { transform } from './spacing-radius.mjs';

const FILE = 'apps/mobile/src/features/demo/Demo.tsx';
const run = (text, file = FILE) => {
  const { edits, unresolved } = transform(file, text);
  return { out: applyEdits(text, edits), unresolved };
};

test('on-scale spacing and radius become their steps, a negative keeps its sign, and the import is added', () => {
  const { out, unresolved } = run(
    [
      "import { StyleSheet } from 'react-native';",
      "import { SdsColors } from '@skkuverse/shared';",
      'const styles = StyleSheet.create({',
      '  row: { paddingVertical: 12, marginTop: -4, gap: 8, borderRadius: 12, borderTopLeftRadius: 8 },',
      '});',
      '',
    ].join('\n'),
  );
  assert.deepEqual(unresolved, []);
  assert.match(out, /import \{ SdsColors, SdsRadius, SdsSpacing \} from '@skkuverse\/shared';/);
  assert.match(out, /row: \{ paddingVertical: SdsSpacing\.x3, marginTop: -SdsSpacing\.x1, gap: SdsSpacing\.x2, borderRadius: SdsRadius\.r3, borderTopLeftRadius: SdsRadius\.r2 \}/);
});

test('a horizontal 20 is the gutter unless the entry is listed as a control or a card; a vertical 20 is x5', () => {
  const { out } = run(
    [
      "import { StyleSheet } from 'react-native';",
      'const styles = StyleSheet.create({',
      '  list: { paddingHorizontal: 20, paddingTop: 20, marginLeft: 20 },',
      '  retryButton: { paddingHorizontal: 20 },',
      '});',
      '',
    ].join('\n'),
    'apps/mobile/app/webview.tsx',
  );
  assert.match(out, /list: \{ paddingHorizontal: SdsSpacing\.gutter, paddingTop: SdsSpacing\.x5, marginLeft: SdsSpacing\.gutter \}/);
  assert.match(out, /retryButton: \{ paddingHorizontal: SdsSpacing\.x5 \}/);
  assert.match(out, /^import \{ SdsSpacing \} from '@skkuverse\/shared';$/m);
});

test('a uniform pill radius becomes full; a per-corner half-height radius keeps its step', () => {
  const { out } = run(
    [
      "import { StyleSheet } from 'react-native';",
      "import { SdsRadius } from '@skkuverse/shared';",
      'const styles = StyleSheet.create({',
      '  pill: { height: 32, borderRadius: 16 },',
      '  dot: { width: 8, height: 8, borderRadius: 4 },',
      '  wide: { height: 44, borderRadius: 22 },',
      '  big: { borderRadius: 999 },',
      '  tab: { height: 40, borderTopLeftRadius: 20 },',
      '  card: { height: 100, borderRadius: 12 },',
      '});',
      '',
    ].join('\n'),
  );
  assert.match(out, /pill: \{ height: 32, borderRadius: SdsRadius\.full \}/);
  assert.match(out, /dot: \{ width: 8, height: 8, borderRadius: SdsRadius\.full \}/);
  assert.match(out, /wide: \{ height: 44, borderRadius: SdsRadius\.full \}/);
  assert.match(out, /big: \{ borderRadius: SdsRadius\.full \}/);
  assert.match(out, /tab: \{ height: 40, borderTopLeftRadius: SdsRadius\.r5 \}/);
  assert.match(out, /card: \{ height: 100, borderRadius: SdsRadius\.r3 \}/);
  assert.match(out, /^import \{ SdsRadius \} from '@skkuverse\/shared';$/m, 'an existing import is reused');
});

test('off-scale values and literals outside a style are reported and left alone', () => {
  const text = [
    "import { StyleSheet } from 'react-native';",
    'const styles = StyleSheet.create({ a: { padding: 7, borderRadius: 22 } });',
    'const props = { gap: 4 };',
    '',
  ].join('\n');
  const { out, unresolved } = run(text);
  assert.equal(out, text);
  assert.deepEqual(
    unresolved.map((u) => u.reason),
    ['padding: 7 is off the spacing scale', 'borderRadius: 22 is off the radius scale', 'gap: 4 is not in a style object'],
  );
});

test('inline styles, style-named variables and JSX attributes the lint reads are moved', () => {
  const { out } = run(
    [
      "import { View } from 'react-native';",
      "import { Skeleton } from '@skkuverse/sds';",
      'const rowStyle = { paddingVertical: 4 } as const;',
      'export function Demo() {',
      '  return <View style={{ gap: 8 }}><Skeleton borderRadius={8} /></View>;',
      '}',
      '',
    ].join('\n'),
  );
  assert.match(out, /const rowStyle = \{ paddingVertical: SdsSpacing\.x1 \} as const;/);
  assert.match(out, /style=\{\{ gap: SdsSpacing\.x2 \}\}/);
  assert.match(out, /<Skeleton borderRadius=\{SdsRadius\.r2\} \/>/);
  assert.match(out, /^import \{ SdsRadius, SdsSpacing \} from '@skkuverse\/shared';$/m);
});
