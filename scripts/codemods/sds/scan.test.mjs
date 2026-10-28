// The migration scanner's binding resolution: a site is found by what its
// identifier was imported as and from where, and a style reference by the
// sheet it names in the same file. Each fixture is a small source file
// scanned as if it lived in the app.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { compareWithRecord, countsByRule, scanSource } from './scan.mjs';

const FILE = 'apps/mobile/src/features/demo/Demo.tsx';
const scan = (source) => scanSource(FILE, source);

test('an aliased Text from react-native is React Native text; react-native-svg Text is not', () => {
  const R = scan(`
import { View, Text as RNText } from 'react-native';
import { Text } from 'react-native-svg';
export function Demo() {
  return <View><RNText>one</RNText><Text>svg</Text></View>;
}`);
  assert.deepEqual(R.rnText.map((r) => [r.tag, r.element, r.line]), [['RNText', 'Text', 5]]);
});

test('Text through a namespace import and Animated.Text are found by their binding', () => {
  const R = scan(`
import * as RN from 'react-native';
import Reanimated from 'react-native-reanimated';
import { Animated } from 'react-native';
const Other = { Text: () => null };
export function Demo() {
  return <><RN.Text>a</RN.Text><Reanimated.Text>b</Reanimated.Text><Animated.Text>c</Animated.Text><Other.Text /></>;
}`);
  assert.deepEqual(R.rnText.map((r) => [r.tag, r.element]), [
    ['RN.Text', 'Text'],
    ['Reanimated.Text', 'Animated.Text'],
    ['Animated.Text', 'Animated.Text'],
  ]);
});

test('every name of a multi-name import resolves, aliases included', () => {
  const R = scan(`
import { SdsColors, SdsSpacing as S, SdsRadius } from '@skkuverse/shared';
export function Demo() {
  return <View style={{ padding: S.x2, borderRadius: SdsRadius.r2, backgroundColor: SdsColors.grey100 }} />;
}`);
  assert.deepEqual(R.sdsColors.map((r) => [r.local, r.name, r.group]), [['SdsColors', 'grey100', 'bg']]);
  assert.deepEqual(R.tokenUse.map((r) => [r.api, r.name, r.key]), [['SdsSpacing', 'x2', 'padding'], ['SdsRadius', 'r2', 'borderRadius']]);
});

test('SdsColors is found under an alias, and an unimported SdsColors or a type-only import is not', () => {
  const R = scan(`
import { SdsColors as C } from '@skkuverse/shared';
import type { SdsColors as T } from '@skkuverse/shared';
const SdsColors = { grey900: '#000' };
export function Demo() {
  const local = SdsColors.grey900;
  return <Txt color={C.grey500}>x</Txt>;
}`);
  assert.deepEqual(R.sdsColors.map((r) => [r.local, r.name, r.group, r.scope, r.fn]), [['C', 'grey500', 'fg', 'component', 'Demo']]);
});

test('a relative import inside SDS is our own module', () => {
  const R = scanSource('packages/sds/src/components/demo/Demo.tsx', `
import { SdsColors } from '../../foundation/colors';
export function Demo() { return <View style={{ borderColor: SdsColors.grey200 }} />; }`);
  assert.deepEqual(R.sdsColors.map((r) => [r.name, r.group]), [['grey200', 'stroke']]);
});

test('a same-file style reference resolves to its sheet entry, through arrays and conditions', () => {
  const R = scan(`
import { StyleSheet, Text } from 'react-native';
import { SdsColors } from '@skkuverse/shared';
import { shared } from './styles';
export function Demo({ on }) {
  return (
    <>
      <Text style={[styles.title, on && styles.active]}>a</Text>
      <Text style={shared.row}>b</Text>
    </>
  );
}
const styles = StyleSheet.create({
  title: { fontSize: 15, lineHeight: 22, color: SdsColors.grey900, paddingHorizontal: 16 },
  active: { fontWeight: '700' },
});`);
  const [a, b] = R.rnText;
  assert.equal(a.styleRefs, 'styles.title styles.active');
  assert.equal(a.fontSize, 15);
  assert.equal(a.lineHeight, 22);
  assert.equal(a.fontWeight, '700');
  assert.equal(a.unresolved, '');
  // A style from another file is left unresolved, never guessed.
  assert.equal(b.styleRefs, '?shared.row');
  assert.equal(b.unresolved, 'shared.row');
  // The sheet's own sites know their sheet and the elements that use the entry.
  const pad = R.spacing.find((r) => r.prop === 'paddingHorizontal');
  assert.deepEqual([pad.value, pad.scope, pad.sheetVar, pad.objKey, pad.hosts], [16, 'stylesheet-module', 'styles', 'title', 'Text']);
  const color = R.sdsColors[0];
  assert.deepEqual([color.name, color.group, color.scope, color.sheetVar, color.styleKey], ['grey900', 'fg', 'stylesheet-module', 'styles', 'title']);
  assert.deepEqual(R.sheets.map((s) => [s.sheetVar, s.moduleLevel, s.allInComponents]), [['styles', true, true]]);
});

test('a themed sheet resolves through the hook that returns it', () => {
  const R = scan(`
import { Text } from 'react-native';
import { createThemedStyles } from '@skkuverse/sds';
const useStyles = createThemedStyles(({ color }) => ({ label: { fontSize: 13, color: color.fg.neutral } }));
export function Demo() {
  const s = useStyles();
  return <Text style={s.label}>a</Text>;
}`);
  assert.equal(R.rnText[0].styleRefs, 's.label');
  assert.equal(R.rnText[0].fontSize, 13);
  assert.deepEqual(R.semanticUse.map((r) => [r.token, r.scope]), [['fg.neutral', 'themed']]);
  assert.deepEqual(R.sheets, []);
});

test('a radius half the height is a pill, and a line-level disable marks the site', () => {
  const R = scan(`
const box = { height: 32, borderRadius: 16, padding: 8 };
const dot = {
  // eslint-disable-next-line sds/no-spacing-literal -- a hit slop the scale cannot express
  margin: 3,
};`);
  const radius = R.spacing.find((r) => r.kind === 'radius');
  assert.equal(radius.pill, 'pill');
  const margin = R.spacing.find((r) => r.prop === 'margin');
  assert.equal(margin.disabled, true);
  assert.equal(R.spacing.find((r) => r.prop === 'padding').disabled, false);
});

test('pressables are matched by module, and usePressFeedback frees the Pressable it drives', () => {
  const R = scan(`
import { Pressable, TouchableOpacity } from 'react-native';
import { Pressable as GhPressable } from 'react-native-gesture-handler';
import { Pressable as SdsPressable, usePressFeedback } from '@skkuverse/sds';
export function Demo() {
  const feedback = usePressFeedback();
  return <><Pressable /><TouchableOpacity /><GhPressable /><SdsPressable /></>;
}`);
  assert.deepEqual(R.pressables.map((p) => [p.module, p.primitive, p.feedbackHook]), [
    ['react-native', 'Pressable', true],
    ['react-native', 'TouchableOpacity', false],
    ['react-native-gesture-handler', 'Pressable', true],
  ]);
});

test('counts by rule drop exceptions, and the comparison lists the files that differ', () => {
  const R = scan(`
import { Text } from 'react-native';
const s = { padding: 8, margin: 0, gap: 20 };
export function Demo() { return <Text>a</Text>; }`);
  const counts = countsByRule(R, [{ files: [FILE], rules: ['sds/no-rn-text'], reason: 'test' }]);
  assert.deepEqual(counts, { 'sds/no-spacing-literal': { [FILE]: 2 } });
  const rows = compareWithRecord(counts, { [FILE]: { 'sds/no-spacing-literal': { count: 3 } }, 'b.tsx': { 'sds/no-spacing-literal': { count: 1 } } });
  assert.deepEqual(rows, [
    {
      rule: 'sds/no-spacing-literal',
      scan: 2,
      record: 4,
      files: [
        { file: FILE, scan: 2, record: 3 },
        { file: 'b.tsx', scan: 0, record: 1 },
      ],
    },
  ]);
});
