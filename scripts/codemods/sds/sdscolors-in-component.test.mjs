// K3's SdsColors-in-component codemod: an exact read becomes a role name on
// Txt or a `useSemanticColors()` read, and every other read is reported and
// left alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyEdits } from './codemod.mjs';
import { scanSource } from './scan.mjs';
import { colorClass, exactRole, roleFor, tdsNameOf, themeModuleFor, transform } from './sdscolors-in-component.mjs';

const FILE = 'apps/mobile/src/features/demo/Demo.tsx';
const run = (text, file = FILE) => {
  const { edits, unresolved } = transform(file, text, scanSource(file, text));
  return { out: applyEdits(text, edits), unresolved };
};

test('a Txt color takes the role name; another read injects the hook; the unused import goes', () => {
  const { out, unresolved } = run(
    [
      "import { View } from 'react-native';",
      "import { Txt } from '@skkuverse/sds';",
      "import { SdsColors } from '@skkuverse/shared';",
      'export function Demo() {',
      '  return (',
      '    <View style={{ borderColor: SdsColors.grey700 }}>',
      '      <Txt color={SdsColors.grey600}>a</Txt>',
      '    </View>',
      '  );',
      '}',
      '',
    ].join('\n'),
  );
  assert.deepEqual(unresolved, []);
  assert.equal(
    out,
    [
      "import { View } from 'react-native';",
      "import { Txt, useSemanticColors } from '@skkuverse/sds';",
      'export function Demo() {',
      '  const color = useSemanticColors();',
      '  return (',
      '    <View style={{ borderColor: color.stroke.neutralSolid }}>',
      '      <Txt color="neutralSubtle">a</Txt>',
      '    </View>',
      '  );',
      '}',
      '',
    ].join('\n'),
  );
});

test('a taken `color` gives `semantic`; an existing binding is reused; a dependency list gains it', () => {
  const { out } = run(
    [
      "import { useMemo } from 'react';",
      "import { useSemanticColors } from '@skkuverse/sds';",
      "import { SdsColors } from '@skkuverse/shared';",
      'export function A({ color }: { color: string }) {',
      '  return <Icon color={SdsColors.grey900} tint={color} />;',
      '}',
      'export function B() {',
      '  const theme = useSemanticColors();',
      '  const box = useMemo(() => ({ borderColor: SdsColors.grey700 }), []);',
      '  return <View style={box} />;',
      '}',
      '',
    ].join('\n'),
  );
  assert.match(out, /export function A\(\{ color \}: \{ color: string \}\) \{\n  const semantic = useSemanticColors\(\);\n  return <Icon color=\{semantic\.fg\.neutral\}/);
  assert.match(out, /const box = useMemo\(\(\) => \(\{ borderColor: theme\.stroke\.neutralSolid \}\), \[theme\]\);/);
  assert.doesNotMatch(out, /SdsColors/);
});

test('reads with no exact role, at module scope, in a StyleSheet or a parameter default are reported and left', () => {
  const text = [
    "import { StyleSheet } from 'react-native';",
    "import { SdsColors } from '@skkuverse/shared';",
    'const TINT = SdsColors.grey900;',
    'const styles = StyleSheet.create({ a: { color: SdsColors.grey900 } });',
    'export function C({ tint = SdsColors.grey900 }) {',
    '  return <Icon color={SdsColors.grey500} tint={tint} />;',
    '}',
    '',
  ].join('\n');
  const { out, unresolved } = run(text);
  assert.equal(out, text);
  assert.deepEqual(
    unresolved.map((u) => u.reason),
    [
      'SdsColors.grey900: module scope',
      'SdsColors.grey900: stylesheet-module scope',
      'SdsColors.grey900: a parameter default, read before the body runs',
      'SdsColors.grey500 as fg: no exact role',
    ],
  );
});

test('inside SDS the hook comes from the theme module', () => {
  assert.equal(themeModuleFor('packages/sds/src/components/navbar/Navbar.tsx'), '../../core/theme');
  assert.equal(themeModuleFor('apps/mobile/src/features/demo/Demo.tsx'), '@skkuverse/sds');
});

const runWith = (text, options, file = FILE) => {
  const { edits, unresolved } = transform(file, text, scanSource(file, text), options);
  return { out: applyEdits(text, edits), unresolved };
};

test('mapping classes: exact, C3 by distance, C4 beyond it, C5 for a decision or a context', () => {
  assert.equal(colorClass('grey600', 'fg'), 'exact');
  assert.equal(colorClass('grey200', 'stroke'), 'C3');
  assert.equal(colorClass('brand', 'fg'), 'C4');
  assert.equal(colorClass('grey500', 'fg'), 'C5');
  assert.equal(colorClass('grey100', 'bg'), 'C5');
  assert.equal(colorClass('grey200', 'fg'), null);
  assert.deepEqual(roleFor('grey200', 'stroke', { classes: ['C3'] }), { next: 'stroke.neutralMuted', cls: 'C3' });
  assert.equal(roleFor('grey200', 'stroke'), null);
  assert.equal(roleFor('grey100', 'bg', { classes: ['C5'] }), null);
  assert.deepEqual(roleFor('grey100', 'bg', { classes: ['C5'], context: 'control' }), { next: 'bg.neutralWeak', cls: 'C5' });
  assert.deepEqual(exactRole('grey600', 'fg'), { next: 'fg.neutralSubtle' });
  assert.equal(exactRole('grey100', 'bg'), null);
});

test('a literal reads as the TDS name of its value, never a white veil as a grey tint', () => {
  assert.equal(tdsNameOf('#FFFFFF'), 'background');
  assert.equal(tdsNameOf('#F9FAFB'), 'grey50');
  assert.equal(tdsNameOf('rgba(255,255,255,0.22)'), null);
  assert.equal(tdsNameOf('transparent'), null);
  assert.equal(tdsNameOf('#123456'), null);
});

test('a themed factory with no argument gains ({ color }); a literal in a bare attribute gains braces', () => {
  const { out, unresolved } = runWith(
    [
      "import { View } from 'react-native';",
      "import { createThemedStyles } from '@skkuverse/sds';",
      "import { SdsColors } from '@skkuverse/shared';",
      'const useStyles = createThemedStyles(() => ({',
      '  line: { borderColor: SdsColors.grey200 },',
      "  fill: { backgroundColor: '#EEE' },",
      '}));',
      'export function D() {',
      '  const styles = useStyles();',
      '  return <View style={styles.line}><Icon color="#1A8A5C" /></View>;',
      '}',
      '',
    ].join('\n'),
    { classes: ['C3', 'C4'] },
  );
  assert.deepEqual(unresolved, []);
  assert.match(out, /createThemedStyles\(\(\{ color \}\) => \(\{\n  line: \{ borderColor: color\.stroke\.neutralMuted \},\n  fill: \{ backgroundColor: color\.bg\.neutralWeak \},/);
  assert.match(out, /const color = useSemanticColors\(\);[\s\S]*<Icon color=\{color\.fg\.brand\} \/>/);
  assert.doesNotMatch(out, /SdsColors/);
});

test('a grey fill takes its context from the style name, and an always-dark surface is left', () => {
  const text = [
    "import { createThemedStyles } from '@skkuverse/sds';",
    "import { SdsColors } from '@skkuverse/shared';",
    'const useStyles = createThemedStyles(({ color }) => ({',
    '  container: { backgroundColor: SdsColors.grey100 },',
    '  chip: { backgroundColor: SdsColors.grey100 },',
    '  other: { backgroundColor: SdsColors.grey100 },',
    '}));',
    '',
  ].join('\n');
  const { out, unresolved } = runWith(text, { classes: ['C5'] });
  assert.match(out, /container: \{ backgroundColor: color\.bg\.layerBasement \}/);
  assert.match(out, /chip: \{ backgroundColor: color\.bg\.neutralWeak \}/);
  assert.deepEqual(unresolved.map((u) => u.reason), ['SdsColors.grey100 as bg: no context named']);
  const dark = runWith(text, { classes: ['C5'] }, 'apps/mobile/src/features/video/VideoGalleryScreen.tsx');
  assert.equal(dark.out, text);
});
