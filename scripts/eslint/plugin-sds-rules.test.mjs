// The design rules of the local `sds` ESLint plugin (scripts/eslint/plugin-sds.cjs),
// through ESLint's RuleTester under node:test, parsed as TypeScript with JSX
// the way the root config parses app code. sds/require-disable-reason has its
// own suite in plugin-sds.test.mjs.
import { describe, it, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const plugin = require('./plugin-sds.cjs');

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const run = (name, cases) => ruleTester.run(`sds/${name}`, plugin.rules[name], cases);
const err = (messageId, data) => (data ? { messageId, data } : { messageId });

// ── Color ───────────────────────────────────────────────────────────────────

run('no-color-literal', {
  valid: [
    // 'transparent' is the same in both schemes.
    "const a = <View style={{ backgroundColor: 'transparent' }} />;",
    // A type, an import path and an object key are not values.
    "type Hex = '#FFFFFF';",
    "const m = { '#fff': 1 };",
    // A CSS name outside a color position is another word.
    "const s = { tone: 'white' };",
    'function A() { const color = useSemanticColors(); return <View style={{ color: color.fg.neutral }} />; }',
  ],
  invalid: [
    { code: "const styles = StyleSheet.create({ title: { color: '#191F28' } });", errors: [err('module', { value: '#191F28' })] },
    { code: "function A() { return <View style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }} />; }", errors: [err('literal', { value: 'rgba(0, 0, 0, 0.5)' })] },
    { code: 'const f = () => `#ABCDEF`;', errors: [err('literal', { value: '#ABCDEF' })] },
    { code: '<Svg><Path fill="#4285F4" /></Svg>;', errors: [err('module', { value: '#4285F4' })] },
    { code: "const s = { borderColor: on ? 'white' : c };", errors: [err('named', { value: 'white' })] },
  ],
});

run('no-color-in-string', {
  valid: [
    "const a = '#FFFFFF';", // sds/no-color-literal's
    "const url = 'https://skkuverse.com/p/notices#section';",
    'const css = `body { color: ${color.fg.neutral}; }`;',
    "type T = `#${string}`;",
  ],
  invalid: [
    { code: "const s = { boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.18)' };", errors: [err('inString', { snippet: 'rgba(' })] },
    { code: 'const css = `a { color: ${c}; border: 1px solid #DDDDDD; }`;', errors: [err('inString', { snippet: '#DDDDDD' })] },
    { code: "const svg = '<rect fill=\"#F5F5F5\"/>';", errors: [err('inString', { snippet: '#F5F5F5' })] },
  ],
});

run('no-sds-colors', {
  valid: [
    // A type-only reference reads no value.
    "import { SdsColors } from '@skkuverse/shared';\ntype Name = keyof typeof SdsColors;",
    "import type { SdsColors } from '@skkuverse/shared';\ntype Name = keyof typeof SdsColors;",
    // Someone else's SdsColors.
    "import { SdsColors } from 'some-library';\nconst a = () => SdsColors.grey600;",
  ],
  invalid: [
    {
      code: "import { SdsColors } from '@skkuverse/shared';\nfunction A() { return <Txt color={SdsColors.grey600}>x</Txt>; }",
      errors: [err('read', { name: 'grey600' })],
    },
    // Found by binding, under an alias.
    { code: "import { SdsColors as C } from '@skkuverse/sds';\nconst f = () => C.grey900;", errors: [err('read', { name: 'grey900' })] },
    {
      code: "import { SdsColors } from '@skkuverse/shared';\nconst styles = StyleSheet.create({ a: { color: SdsColors.grey900 } });",
      errors: [err('sheet', { name: 'grey900' })],
    },
    { code: "import { SdsColors } from '@skkuverse/shared';\nconst BORDER = SdsColors.grey200;", errors: [err('module', { name: 'grey200' })] },
    { code: "import { SdsColors } from '../../tokens';\nconst f = () => paint(SdsColors);", errors: [err('whole')] },
  ],
});

run('no-static-theme', {
  valid: [
    // The same value in both schemes by definition.
    "import { SdsPalette } from '@skkuverse/shared';\nconst white = SdsPalette.static.white;",
    "import type { SdsSemanticColors } from '@skkuverse/shared';\ntype S = typeof SdsSemanticColors;",
  ],
  invalid: [
    {
      code: "import { SdsSemanticColors } from '@skkuverse/shared';\nconst ink = SdsSemanticColors.light.fg.neutral;",
      errors: [err('semantic', { mode: 'light' })],
    },
    { code: "import { SdsPalette } from '@skkuverse/shared';\nconst ground = SdsPalette.pine[1000].light;", errors: [err('palette')] },
    { code: "import { colorSeeds } from '@skkuverse/sds';\nconst cta = colorSeeds.brand;", errors: [err('seeds')] },
    {
      code: "import { getAdaptiveColors } from '../foundation/colors';\nconst c = getAdaptiveColors('dark');",
      errors: [err('resolve', { name: 'getAdaptiveColors' })],
    },
  ],
});

run('no-use-adaptive', {
  valid: ['function A() { const color = useSemanticColors(); }'],
  invalid: [{ code: 'function A() { const c = useAdaptive(); }', errors: [err('adaptive')] }],
});

run('role-placement', {
  valid: [
    'const s = { backgroundColor: color.bg.brandSolid, color: color.fg.onBrandSolid, borderColor: color.stroke.neutralWeak };',
    '<CheckIcon color={color.fg.onBrandSolid} />;',
    '<TextInput placeholderTextColor={color.fg.placeholder} />;',
    // Properties the rule does not classify.
    'const s = { tintColor: color.bg.brandSolid, shadowColor: color.fg.neutral };',
    // A derived value is not a role read.
    'const s = { backgroundColor: hexToRgba(color.fg.brand, 0.1) };',
    // The test of a conditional is not the value.
    'const s = { color: color.bg.x ? color.fg.neutral : color.fg.disabled };',
    // A divider or hairline is a line drawn as a thin View: a stroke role may fill it.
    '<View style={{ height: StyleSheet.hairlineWidth, backgroundColor: color.stroke.neutralSubtle }} />;',
  ],
  invalid: [
    {
      code: 'const s = { backgroundColor: color.fg.neutral };',
      errors: [err('misplaced', { role: 'fg.neutral', family: 'fg', key: 'backgroundColor', what: 'a surface', want: 'bg' })],
    },
    {
      code: 'const s = { borderColor: color.bg.brandSolid };',
      errors: [err('misplaced', { role: 'bg.brandSolid', family: 'bg', key: 'borderColor', what: 'a line', want: 'stroke' })],
    },
    {
      code: 'const s = { color: theme.color.stroke.neutralMuted };',
      errors: [err('misplaced', { role: 'stroke.neutralMuted', family: 'stroke', key: 'color', what: 'text or an icon', want: 'fg' })],
    },
    {
      code: 'const s = { backgroundColor: pressed ? color.fg.neutral : color.bg.neutralWeak };',
      errors: [err('misplaced', { role: 'fg.neutral', family: 'fg', key: 'backgroundColor', what: 'a surface', want: 'bg' })],
    },
    {
      code: '<View style={{ borderBottomColor: color.fg.brand }} />;',
      errors: [err('misplaced', { role: 'fg.brand', family: 'fg', key: 'borderBottomColor', what: 'a line', want: 'stroke' })],
    },
    {
      code: '<TextInput placeholderTextColor={color.bg.layerDefault} />;',
      errors: [err('misplaced', { role: 'bg.layerDefault', family: 'bg', key: 'placeholderTextColor', what: 'text or an icon', want: 'fg' })],
    },
  ],
});

// ── Text and type ───────────────────────────────────────────────────────────

run('no-rn-text', {
  valid: [
    // SVG text is not React Native's.
    "import { Text } from 'react-native-svg';\nconst a = <Svg><Text>label</Text></Svg>;",
    "import { Txt } from '@skkuverse/sds';\nconst a = <Txt>x</Txt>;",
    "import { Text } from 'react-native';\ntype P = React.ComponentProps<typeof Text>;",
    "import { Animated } from 'react-native';\nconst a = <Animated.View />;",
  ],
  invalid: [
    // The closing tag is not counted again.
    { code: "import { Text } from 'react-native';\nconst a = <Text>hi</Text>;", errors: [{ ...err('text', { name: 'Text' }), line: 2 }] },
    { code: "import { Text as RNText } from 'react-native';\nconst a = <RNText>hi</RNText>;", errors: [err('text', { name: 'RNText' })] },
    { code: "import { Animated } from 'react-native';\nconst a = <Animated.Text>x</Animated.Text>;", errors: [err('animated', { name: 'Animated.Text' })] },
    { code: "import Animated from 'react-native-reanimated';\nconst a = <Animated.Text />;", errors: [err('animated', { name: 'Animated.Text' })] },
  ],
});

run('no-type-size-literal', {
  valid: [
    'const s = { fontSize: SdsTypeScale.t4.fontSize };',
    '<Txt typography="t4">x</Txt>;',
    'const s = { fontSize: size };',
  ],
  invalid: [
    { code: 'const s = { fontSize: 14 };', errors: [err('size', { key: 'fontSize', value: '14', hint: ' is step t4' })] },
    { code: 'const s = { fontSize: 19 };', errors: [err('size', { key: 'fontSize', value: '19', hint: ' is off the type scale' })] },
    { code: 'const s = { lineHeight: 21, letterSpacing: -0.3 };', errors: [err('size', { key: 'lineHeight', value: '21', hint: '' }), err('size', { key: 'letterSpacing', value: '-0.3', hint: '' })] },
    { code: '<Label fontSize={12} />;', errors: [err('size', { key: 'fontSize', value: '12', hint: ' is step t2' })] },
  ],
});

run('no-font-weight-literal', {
  valid: [
    // A Txt prop table or a recipe's text table names a Txt weight.
    "const label = { typography: 't4', fontWeight: 'bold' };",
    "const s = { ...SdsTypo.t7Regular, ...wantedSans('700') };",
    '<Txt fontWeight="bold">x</Txt>;',
    "const s = { fontWeight: weight };",
  ],
  invalid: [
    { code: "const s = { fontWeight: '700' };", errors: [err('weight', { value: '"700"' })] },
    { code: "const s = { fontWeight: 'bold' };", errors: [err('weight', { value: '"bold"' })] },
    { code: 'const s = { fontWeight: 600 };', errors: [err('weight', { value: '600' })] },
  ],
});

run('no-font-family-literal', {
  valid: ['const s = { fontFamily: WANTED_SANS };', "const s = { ...wantedSans('400') };"],
  invalid: [
    { code: "const s = { fontFamily: 'Courier' };", errors: [err('family', { value: 'Courier' })] },
    { code: 'const s = { fontFamily: `Menlo` };', errors: [err('family', { value: 'Menlo' })] },
  ],
});

// ── Spacing and radius ──────────────────────────────────────────────────────

run('no-spacing-literal', {
  valid: [
    'const s = { padding: SdsSpacing.x3, margin: 0 };',
    // Sizes, positions, line widths and hit slop stay numbers.
    'const s = { width: 12, height: 12, top: 4, borderWidth: 1, hitSlop: 8 };',
    'const { padding = 12 } = props;',
  ],
  invalid: [
    { code: 'const s = { padding: 12 };', errors: [err('onScale', { key: 'padding', value: '12', step: 'SdsSpacing.x3' })] },
    // Off the scale, with the nearest step, two on a tie.
    { code: 'const s = { marginTop: 1 };', errors: [err('offScale', { key: 'marginTop', value: '1', nearest: 'SdsSpacing.x0_5' })] },
    { code: 'const s = { padding: 13 };', errors: [err('offScale', { key: 'padding', value: '13', nearest: 'SdsSpacing.x3 or SdsSpacing.x3_5' })] },
    { code: 'const s = { marginTop: -8 };', errors: [err('onScale', { key: 'marginTop', value: '-8', step: '-SdsSpacing.x2' })] },
    { code: '<Stack gap={8} />;', errors: [err('onScale', { key: 'gap', value: '8', step: 'SdsSpacing.x2' })] },
  ],
});

run('no-radius-literal', {
  valid: ['const s = { borderRadius: SdsRadius.r3 };', 'const s = { borderRadius: 0 };'],
  invalid: [
    { code: 'const s = { borderRadius: 12 };', errors: [err('onScale', { key: 'borderRadius', value: '12', step: 'SdsRadius.r3' })] },
    { code: 'const s = { borderRadius: 999 };', errors: [err('pill', { key: 'borderRadius', value: '999' })] },
    // Half of the element's size rounds the side.
    { code: 'const s = { width: 34, height: 34, borderRadius: 17 };', errors: [err('pill', { key: 'borderRadius', value: '17' })] },
    {
      code: 'const s = { borderTopLeftRadius: 5 };',
      errors: [err('offScale', { key: 'borderTopLeftRadius', value: '5', nearest: 'SdsRadius.r1 or SdsRadius.r1_5' })],
    },
    { code: '<Skeleton borderRadius={30} />;', errors: [err('offScale', { key: 'borderRadius', value: '30', nearest: 'SdsRadius.r6' })] },
  ],
});

// ── Press and primitives ────────────────────────────────────────────────────

run('no-rn-pressable', {
  valid: [
    // SDS's own Pressable has the same name.
    "import { Pressable } from '@skkuverse/sds';\nconst a = <Pressable bg=\"neutralWeak\" />;",
    // Touch on one element, motion on another (SDS.md): RN's Pressable is the trigger.
    "import { Pressable } from 'react-native';\nimport { usePressFeedback } from '@skkuverse/sds';\nfunction A() { const press = usePressFeedback({ bg: 'neutralWeak' }); return <Pressable {...press.triggerProps} />; }",
    "import type { PressableProps } from 'react-native';\ntype P = PressableProps;",
  ],
  invalid: [
    { code: "import { Pressable } from 'react-native';\nconst a = <Pressable onPress={f} />;", errors: [err('pressable', { source: 'react-native' })] },
    { code: "import { TouchableOpacity as TO } from 'react-native';\nconst a = <TO />;", errors: [err('touchable', { name: 'TO' })] },
    // usePressFeedback excuses RN's Pressable only, never a touchable.
    {
      code: "import { TouchableOpacity } from 'react-native';\nfunction A() { usePressFeedback({}); return <TouchableOpacity />; }",
      errors: [err('touchable', { name: 'TouchableOpacity' })],
    },
    // A mention in a comment is not a call.
    {
      code: "// usePressFeedback( goes here later\nimport { Pressable } from 'react-native';\nconst a = <Pressable />;",
      errors: [err('pressable', { source: 'react-native' })],
    },
    { code: "import { Button } from 'react-native';\nconst a = <Button title=\"x\" />;", errors: [err('button')] },
    { code: "import { Pressable } from 'react-native-gesture-handler';\nconst a = <Pressable />;", errors: [err('pressable', { source: 'react-native-gesture-handler' })] },
    { code: "import { TouchableOpacity } from '@gorhom/bottom-sheet';\nconst a = <TouchableOpacity />;", errors: [err('touchable', { name: 'TouchableOpacity' })] },
  ],
});

run('no-press-opacity', {
  valid: ['const s = { opacity: disabled ? 0.4 : 1 };', '<Pressable style={styles.row} />;'],
  invalid: [
    { code: '<View style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })} />;', errors: [err('opacity')] },
    { code: 'const s = { opacity: state.pressed ? 0.5 : 1 };', errors: [err('opacity')] },
    { code: 'const s = { transform: [{ scale: pressed ? 0.96 : 1 }] };', errors: [err('scale')] },
    { code: '<TouchableOpacity activeOpacity={0.7} />;', errors: [err('active')] },
  ],
});

run('no-entering-over-glass', {
  valid: [
    // Fading out is safe: the glass is already drawn and is leaving.
    '<Animated.View exiting={FadeOut}><GlassChip label="a" /></Animated.View>;',
    // Glass beside the animated view, not inside it.
    '<View><Animated.View entering={FadeIn} /><GlassSurface /></View>;',
    '<Animated.View entering={FadeIn}><Txt>a</Txt></Animated.View>;',
  ],
  invalid: [
    { code: '<Animated.View entering={FadeIn}><GlassButtonGroup items={items} /></Animated.View>;', errors: [err('entering', { name: 'GlassButtonGroup' })] },
    {
      code: '<Animated.View entering={FadeIn}>{ready && (<View><GlassView style={s} /></View>)}</Animated.View>;',
      errors: [err('entering', { name: 'GlassView' })],
    },
    { code: '<Animated.View entering={FadeIn}><Row icon={<GlassIconButton label="x" />} /></Animated.View>;', errors: [err('entering', { name: 'GlassIconButton' })] },
  ],
});

run('no-rn-primitive', {
  valid: ["import { Loader, Switch } from '@skkuverse/sds';\nconst a = <><Loader /><Switch /></>;"],
  invalid: [
    { code: "import { ActivityIndicator } from 'react-native';\nconst a = <ActivityIndicator />;", errors: [err('loader')] },
    { code: "import { Switch as RNSwitch } from 'react-native';\nconst a = <RNSwitch />;", errors: [err('switch')] },
  ],
});

run('no-vector-icons', {
  valid: ["import { HouseIcon } from 'phosphor-react-native';"],
  invalid: [
    { code: "import { Ionicons } from '@expo/vector-icons';", errors: [err('icons', { source: '@expo/vector-icons' })] },
    { code: "import Ionicons from '@expo/vector-icons/Ionicons';", errors: [err('icons', { source: '@expo/vector-icons/Ionicons' })] },
    { code: "import Icon from 'react-native-vector-icons/Ionicons';", errors: [err('icons', { source: 'react-native-vector-icons/Ionicons' })] },
  ],
});

// ── Surfaces ────────────────────────────────────────────────────────────────

run('no-raw-shadow', {
  valid: ['const s = { ...SdsShadows.card.legacy };', 'const s = { elevation: 0, shadowColor: c };'],
  invalid: [
    { code: 'const s = { shadowOpacity: 0.1 };', errors: [err('shadow', { key: 'shadowOpacity' })] },
    { code: 'const s = { shadowOffset: { width: 0, height: 2 } };', errors: [err('shadow', { key: 'shadowOffset' })] },
    { code: "const s = { boxShadow: '0px 1px 2px black' };", errors: [err('shadow', { key: 'boxShadow' })] },
    { code: 'const s = { elevation: 4 };', errors: [err('shadow', { key: 'elevation' })] },
  ],
});

run('no-fixed-scheme', {
  valid: [
    "<StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;",
    // An object's style key is a haptic or a font style.
    "Haptics.impact({ style: 'light' });",
    '<BlurView tint="default" />;',
    '<GlassView glassEffectStyle="regular" />;',
  ],
  invalid: [
    { code: '<StatusBar style="dark" />;', errors: [err('scheme', { key: 'style', value: 'dark' })] },
    { code: '<BlurView tint="light" />;', errors: [err('scheme', { key: 'tint', value: 'light' })] },
    { code: "const o = { blurEffect: 'systemMaterialLight' };", errors: [err('scheme', { key: 'blurEffect', value: 'systemMaterialLight' })] },
    { code: "const o = { barStyle: 'dark-content' };", errors: [err('scheme', { key: 'barStyle', value: 'dark-content' })] },
  ],
});

run('no-handbuilt-part', {
  valid: [
    // A wrapper over the SDS part is the intended shape.
    "import { Callout } from '@skkuverse/sds';\nfunction NoticeHintBanner() { return <Callout />; }",
    'function NoticeCard() { return null; }',
    'const helperChip = () => null;',
    "const a = <ResultSection primaryActionProps={{ children: t('common.retry'), onPress }} />;",
  ],
  invalid: [
    {
      code: 'function NoticeHintBanner() { return <View />; }',
      errors: [err('part', { name: 'NoticeHintBanner', kind: 'banner', target: 'Callout, ActionableCallout or DismissibleCallout', rule: 'CALLOUT-07' })],
    },
    { code: 'const ServiceChips = memo(() => null);', errors: [err('part', { name: 'ServiceChips', kind: 'chip', target: 'Chip', rule: 'CHIP-01' })] },
    {
      code: 'export const NoticeEmptyState = () => null;',
      errors: [err('part', { name: 'NoticeEmptyState', kind: 'result state', target: 'ResultSection', rule: 'RESULT-01' })],
    },
    { code: "const a = <Txt>{t('common.retry')}</Txt>;", errors: [err('retry', { name: "{t('common.retry')}" })] },
  ],
});

// ── Accessibility ───────────────────────────────────────────────────────────

run('android-accessibility-role', {
  valid: [
    '<View accessibilityRole="button" />;',
    '<View accessibilityRole="tablist" />;',
    // Android matches the name case-insensitively.
    '<View accessibilityRole="TabList" />;',
    "<View accessibilityRole={multi ? 'checkbox' : 'radio'} />;",
    // A branch Android never takes may name an iOS-only role.
    "<TabList accessibilityRole={Platform.OS === 'ios' ? 'tabbar' : 'tablist'} />;",
    "<TabList accessibilityRole={Platform.OS !== 'android' ? 'tabbar' : 'tablist'} />;",
    "<TabList accessibilityRole={Platform.OS === 'android' ? 'tablist' : 'tabbar'} />;",
    "<TabList accessibilityRole={Platform.select({ ios: 'tabbar', android: 'tablist' })} />;",
    // A value the rule cannot see is not judged.
    '<View accessibilityRole={a11y.role} />;',
    // `role` is the ARIA prop: Android maps an unknown one to nothing rather than throwing.
    '<View role="tabbar" />;',
    "const a = { role: 'tabbar' };",
  ],
  invalid: [
    { code: '<TabList asChild accessibilityRole="tabbar" />;', errors: [err('role', { value: 'tabbar' })] },
    { code: "<View accessibilityRole={'tabbar'} />;", errors: [err('role', { value: 'tabbar' })] },
    { code: "const a11y = { accessibilityRole: 'tabbar' as const };", errors: [err('role', { value: 'tabbar' })] },
    { code: "<View accessibilityRole={Platform.OS === 'ios' ? 'tablist' : 'tabbar'} />;", errors: [err('role', { value: 'tabbar' })] },
    { code: "<View accessibilityRole={Platform.OS === 'web' ? 'tablist' : 'tabbar'} />;", errors: [err('role', { value: 'tabbar' })] },
    { code: "<View accessibilityRole={pressed ? 'tabbar' : 'tab'} />;", errors: [err('role', { value: 'tabbar' })] },
    { code: "<View accessibilityRole={Platform.select({ ios: 'tabbar', default: 'tabbar' })} />;", errors: [err('role', { value: 'tabbar' })] },
    { code: "<View accessibilityRole={role ?? 'tabbar'} />;", errors: [err('role', { value: 'tabbar' })] },
  ],
});

describe('the Android roles read from React Native', () => {
  test('hold the roles the app uses and not the iOS-only ones', () => {
    for (const role of ['button', 'checkbox', 'header', 'imagebutton', 'link', 'none', 'radio', 'tab', 'tablist', 'togglebutton']) {
      assert.ok(plugin.androidRoles.has(role), role);
    }
    assert.ok(!plugin.androidRoles.has('tabbar'));
  });
});

// ── SDS API ─────────────────────────────────────────────────────────────────

run('no-role-cast', {
  valid: ["const a: FgColorName = 'neutral';", 'const b = x satisfies FgColorName;', 'const c = x as string;'],
  invalid: [
    { code: 'const a = name as FgColorName;', errors: [err('match')] },
    { code: 'const b = names as PressableBgToken[];', errors: [err('match')] },
    { code: 'const c = hex as SdsColor;', errors: [err('match')] },
  ],
});

run('recipe-type-imports', {
  valid: ["import type { RecipeTheme } from '../../core/recipe';"],
  invalid: [
    { code: "import { SdsSpacing } from '@skkuverse/shared';", errors: [err('match')] },
    // An inline `type` specifier still leaves a value import that node --test resolves.
    { code: "import { type RecipeTheme } from '../../core/recipe';", errors: [err('match')] },
  ],
});

// ── Messages ────────────────────────────────────────────────────────────────

// One message per rule, quoted whole: what a gate block or a CI failure shows.
// Each names the replacement and the usage rule (packages/sds/SDS.md "Lint rules").
const MESSAGES = {
  'android-accessibility-role': [
    '<View accessibilityRole="tabbar" />;',
    "accessibilityRole 'tabbar' is not a role Android accepts: React Native's ReactAccessibilityDelegate.kt throws on it when the view mounts, and the app goes blank. Use a role from its AccessibilityRole list ('tablist' for a tab bar), or give iOS its own value behind Platform.OS === 'ios' or Platform.select({ ios, android }). See A11Y-07 in packages/sds/SDS.md \"Lint rules\".",
  ],
  'no-color-literal': [
    "function A() { return <View style={{ color: '#191F28' }} />; }",
    'A color literal (#191F28). Read a role: useSemanticColors() in a component, createThemedStyles(({ color }) => …) in a StyleSheet. A data or illustration color takes a disable with its reason. See COLOR-01 in packages/sds/SDS.md "Lint rules".',
  ],
  'no-color-in-string': [
    "const s = { boxShadow: '0 1px 4px rgba(0, 0, 0, 0.18)' };",
    'A color inside a string (rgba(). Interpolate a role value from useSemanticColors() instead, or disable with a reason for a page that is light only. See COLOR-01 in packages/sds/SDS.md "Lint rules".',
  ],
  'no-sds-colors': [
    "import { SdsColors } from '@skkuverse/shared';\nconst f = () => SdsColors.grey600;",
    'SdsColors.grey600 is the light value, fixed at load. Read a role: useSemanticColors() in a component, createThemedStyles(({ color }) => …) in a StyleSheet; packages/sds/SDS.md "Moving a TDS name to a role" maps each name. See COLOR-01 in packages/sds/SDS.md "Lint rules".',
  ],
  'no-static-theme': [
    "import { SdsSemanticColors } from '@skkuverse/shared';\nconst ink = SdsSemanticColors.light.fg.neutral;",
    'SdsSemanticColors.light is fixed to one scheme. Read useSemanticColors() or createThemedStyles(). See COLOR-20 in packages/sds/SDS.md "Lint rules".',
  ],
  'no-use-adaptive': [
    'function A() { const c = useAdaptive(); }',
    'useAdaptive() reads the TDS names. Read a role from useSemanticColors() or createThemedStyles(). See COLOR-01 in packages/sds/SDS.md "Lint rules".',
  ],
  'role-placement': [
    'const s = { backgroundColor: color.fg.neutral };',
    'fg.neutral is a fg role on backgroundColor, which draws a surface. Use a bg.* role: fg for text and icons, bg for surfaces, stroke for lines. See COLOR-03 in packages/sds/SDS.md "Lint rules".',
  ],
  'no-rn-text': [
    "import { Text } from 'react-native';\nconst a = <Text>hi</Text>;",
    'React Native\'s Text (Text). Use <Txt typography fontWeight> from @skkuverse/sds. See TYPE-01 in packages/sds/SDS.md "Lint rules".',
  ],
  'no-type-size-literal': [
    'const s = { fontSize: 14 };',
    'fontSize: 14 is step t4. Use a step: <Txt typography="t…"> or ...SdsTypo.t…{Weight}, which pair the size with its line height. See TYPE-01 in packages/sds/SDS.md "Lint rules".',
  ],
  'no-font-weight-literal': [
    "const s = { fontWeight: '700' };",
    'fontWeight: "700" loses WantedSans on Android. Use <Txt fontWeight>, or spread ...wantedSans(\'<100–900>\') with the step. See TYPE-01 in packages/sds/SDS.md "Lint rules".',
  ],
  'no-font-family-literal': [
    "const s = { fontFamily: 'Courier' };",
    'fontFamily: \'Courier\'. WantedSans comes from <Txt>, SdsTypo or wantedSans(); emoji come from <Tossface>. See TYPE-01 in packages/sds/SDS.md "Lint rules".',
  ],
  'no-spacing-literal': [
    'const s = { padding: 13 };',
    'padding: 13 is off the SdsSpacing scale. Use the nearest step, SdsSpacing.x3 or SdsSpacing.x3_5, or disable with a reason. See SPACE-01 in packages/sds/SDS.md "Lint rules".',
  ],
  'no-radius-literal': [
    'const s = { borderRadius: 12 };',
    'borderRadius: 12 is SdsRadius.r3. Use the token. See RADIUS-01 in packages/sds/SDS.md "Lint rules".',
  ],
  'no-rn-pressable': [
    "import { Pressable } from 'react-native';\nconst a = <Pressable />;",
    'react-native\'s Pressable. Use Pressable from @skkuverse/sds with bg="<role>" (feedback="none" for a bare hit area), or call usePressFeedback in this file for motion on another element. See PRESS-01 in packages/sds/SDS.md "Lint rules".',
  ],
  'no-press-opacity': [
    '<View style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })} />;',
    'Opacity as press feedback. Use Pressable from @skkuverse/sds with bg="<role>": a press changes the surface and shrinks by a fixed distance, and opacity is for disabled only. See PRESS-02 in packages/sds/SDS.md "Lint rules".',
  ],
  'no-rn-primitive': [
    "import { ActivityIndicator } from 'react-native';\nconst a = <ActivityIndicator />;",
    'ActivityIndicator. Use Loader from @skkuverse/sds. See LOAD-03 in packages/sds/SDS.md "Lint rules".',
  ],
  'no-vector-icons': [
    "import { Ionicons } from '@expo/vector-icons';",
    '@expo/vector-icons. Draw UI icons from phosphor-react-native (the *Icon components). See ICON-01 in packages/sds/SDS.md "Lint rules".',
  ],
  'no-raw-shadow': [
    'const s = { shadowRadius: 4 };',
    'shadowRadius spelled out. Use SdsShadows. See ELEV-04 in packages/sds/SDS.md "Lint rules".',
  ],
  'no-fixed-scheme': [
    '<StatusBar style="dark" />;',
    'style="dark" fixes the scheme. Derive it from useResolvedScheme() from @skkuverse/sds. See COLOR-20 in packages/sds/SDS.md "Lint rules".',
  ],
  'no-entering-over-glass': [
    '<Animated.View entering={FadeIn}><GlassChip label="a" /></Animated.View>;',
    '`entering` over GlassChip. Liquid Glass mounted under a mount animation can draw nothing until its screen is covered and shown again. Mount the glass plainly: drop `entering` and keep `exiting`. See MOTION-04 in packages/sds/SDS.md "Lint rules".',
  ],
  'no-handbuilt-part': [
    'function NoticeHintBanner() { return <View />; }',
    'NoticeHintBanner looks like a hand-built banner. Use Callout, ActionableCallout or DismissibleCallout from @skkuverse/sds, or disable with the reason it cannot. See CALLOUT-07 in packages/sds/SDS.md "Lint rules".',
  ],
  'no-role-cast': [
    'const a = name as FgColorName;',
    'A cast to a role type skips the check the type exists for. Pick a role, or vouch for a data color with asSdsColor() and a reason. See COLOR-01 in packages/sds/SDS.md "Lint rules".',
  ],
  'recipe-type-imports': [
    "import { SdsSpacing } from '@skkuverse/shared';",
    'A recipe imports types only, so its node --test can load it. Take tokens from the RecipeTheme argument instead. See packages/sds/SDS.md "Recipes".',
  ],
  'require-disable-reason': [
    '// eslint-disable-next-line sds/no-color-literal\nconst a = 1;',
    'Disabling sds/no-color-literal needs a reason of at least 10 characters: `// eslint-disable-next-line sds/no-color-literal -- <why>`. See docs/how-to/work-under-the-lint-ratchet.md.',
  ],
};

describe('messages', () => {
  test('every rule has a quoted message below', () => {
    assert.deepEqual(Object.keys(MESSAGES).sort(), Object.keys(plugin.rules).sort());
  });

  // The usage rule each message cites, or the doc that explains a rule with none.
  const POINTER = /See (?:(?:[A-Z][A-Z0-9]*-\d{2}|\{\{rule\}\}) in packages\/sds\/SDS\.md "Lint rules"|packages\/sds\/SDS\.md "Recipes"|docs\/how-to\/work-under-the-lint-ratchet\.md)\.$/;
  for (const [name, rule] of Object.entries(plugin.rules)) {
    test(`every message of sds/${name} ends with where the rule is explained`, () => {
      for (const [id, text] of Object.entries(rule.meta.messages)) assert.match(text, POINTER, `${name}: ${id}`);
    });
  }
});

// require-disable-reason needs the rule it names to exist.
const stub = { meta: { schema: [] }, create: () => ({}) };
const messageTester = new RuleTester({
  languageOptions: { parser: tsParser, ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } },
  plugins: { sds: { rules: { 'no-color-literal': stub } } },
});
for (const [name, [code, message]] of Object.entries(MESSAGES)) {
  messageTester.run(`sds/${name} message`, plugin.rules[name], { valid: [], invalid: [{ code, errors: [{ message }] }] });
}

// ── Scales ──────────────────────────────────────────────────────────────────

describe('the scales the messages name', () => {
  const tokens = resolve(dirname(fileURLToPath(import.meta.url)), '../../packages/shared/src/tokens');
  const load = (name) => import(pathToFileURL(resolve(tokens, `${name}.ts`)).href);
  /** value → step name, the shape the plugin keeps. */
  const byValue = (scale, valueOf = (v) => v) =>
    Object.fromEntries(Object.entries(scale).map(([step, value]) => [String(valueOf(value)), step]));

  test('match SdsTypeScale', async () => {
    const { SdsTypeScale } = await load('typography');
    assert.deepEqual(plugin.scales.type, byValue(SdsTypeScale, (step) => step.fontSize));
  });

  test('match SdsSpacing', async () => {
    const { SdsSpacing } = await load('spacing');
    // The TDS names stay in spacing.ts for the web copies (ADR 0013).
    const seed = Object.fromEntries(Object.entries(SdsSpacing).filter(([step]) => /^x\d/.test(step)));
    assert.deepEqual(plugin.scales.spacing, byValue(seed));
  });

  test('match SdsRadius', async () => {
    const { SdsRadius } = await load('radius');
    // `full` is the pill message's; the TDS names stay for the web copies.
    const seed = Object.fromEntries(Object.entries(SdsRadius).filter(([step]) => /^r\d/.test(step)));
    assert.deepEqual(plugin.scales.radius, byValue(seed));
  });
});
