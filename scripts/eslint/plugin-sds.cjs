// The local ESLint plugin `sds`: the rules that keep app code on the Skku
// Design System (packages/sds/SDS.md). The root eslint.config.js registers it
// as `sds`, so it needs no package and no build.
//
// One rule ID per concern. Bulk suppressions (eslint-suppressions.json) count
// violations per file and rule ID, so two concerns sharing an ID would share
// a count: fixing one and adding the other would pass, and pruning could not
// tell them apart. ADR 0016 describes the rest of the mechanism.
//
// Every message says what to use instead and names the usage rule it
// enforces (COLOR-01, TYPE-01, …), listed beside the rule ID in
// packages/sds/SDS.md "Lint rules". A gate block or a CI failure quotes the
// message alone, so the message has to teach the fix by itself.
//
// Rules that look for a component or a hook find it by its import binding,
// not by its name, so `Text as RNText` is caught and react-native-svg's `Text`
// or SDS's own `Pressable` are not. The scales the messages name are pinned to
// the token files by scripts/eslint/plugin-sds.test.mjs.
'use strict';

const MIN_REASON = 10;

/** The pointer every message ends with: the usage rule and where it is listed. */
const see = (rule) => ` See ${rule} in packages/sds/SDS.md "Lint rules".`;

// ── Helpers ─────────────────────────────────────────────────────────────────

const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const COLOR_FUNCTION = /^(?:rgba?|hsla?|hwb|lab|lch|oklch|oklab)\(/i;
const COLOR_IN_STRING = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})\b|\b(?:rgba?|hsla?)\(/i;
const NAMED_COLORS = new Set([
  'white', 'black', 'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'gray', 'grey',
  'brown', 'cyan', 'magenta', 'lime', 'navy', 'teal', 'silver', 'gold', 'maroon', 'olive', 'aqua',
  'fuchsia', 'violet', 'indigo', 'crimson', 'coral', 'salmon', 'tomato', 'darkgray', 'darkgrey',
  'lightgray', 'lightgrey', 'whitesmoke', 'gainsboro', 'currentcolor',
]);
/** A key whose value is a color, where a CSS name such as 'white' means the color. */
const COLOR_KEY = /(?:^color$|Color$|^fill$|^stroke$|^tint$|^colors$|^background$)/;

/** The name of a Property's or JSXAttribute's key, or null. */
function keyName(prop) {
  if (!prop || (prop.type !== 'Property' && prop.type !== 'JSXAttribute')) return null;
  const key = prop.type === 'Property' ? prop.key : prop.name;
  if (!key) return null;
  if (key.type === 'Identifier' || key.type === 'JSXIdentifier') return key.name;
  if (key.type === 'Literal' && typeof key.value === 'string') return key.value;
  return null;
}

/** A string literal's value, or a template literal's when it interpolates nothing. */
function stringValue(node) {
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0].value.cooked;
  return null;
}

/** A numeric literal's value, `-n` included, or null. */
function numberValue(node) {
  if (node.type === 'Literal' && typeof node.value === 'number') return node.value;
  if (
    node.type === 'UnaryExpression' &&
    node.operator === '-' &&
    node.argument.type === 'Literal' &&
    typeof node.argument.value === 'number'
  ) {
    return -node.argument.value;
  }
  return null;
}

const VALUE_WRAPPERS = new Set([
  'ConditionalExpression',
  'LogicalExpression',
  'ArrayExpression',
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'JSXExpressionContainer',
]);

/** The key a value sits under, through `a ? b : c`, `a ?? b`, arrays and `as`; null when none. */
function owningKey(node) {
  let current = node;
  let parent = current.parent;
  while (parent && VALUE_WRAPPERS.has(parent.type)) {
    // The test of a conditional is not the value the key receives.
    if (parent.type === 'ConditionalExpression' && parent.test === current) return null;
    current = parent;
    parent = current.parent;
  }
  if (parent && parent.type === 'Property' && parent.value === current) return keyName(parent);
  if (parent && parent.type === 'JSXAttribute') return keyName(parent);
  return null;
}

/** A literal that is a type, an import path or an object key rather than a value. */
function isNotAValue(node) {
  const parent = node.parent;
  if (!parent) return false;
  if (parent.type === 'TSLiteralType') return true;
  if ((parent.type === 'ImportDeclaration' || parent.type === 'ExportNamedDeclaration' || parent.type === 'ExportAllDeclaration') && parent.source === node) {
    return true;
  }
  if (parent.type === 'ImportExpression' || parent.type === 'TSExternalModuleReference') return true;
  if (parent.type === 'Property' && parent.key === node && !parent.computed) return true;
  return false;
}

function inFunction(context, node) {
  return context.sourceCode
    .getAncestors(node)
    .some((a) => a.type === 'FunctionDeclaration' || a.type === 'FunctionExpression' || a.type === 'ArrowFunctionExpression');
}

const TYPE_CONTEXTS = new Set([
  'TSTypeAnnotation',
  'TSTypeQuery',
  'TSTypeReference',
  'TSTypeAliasDeclaration',
  'TSInterfaceDeclaration',
  'TSTypeParameterInstantiation',
  'TSTypeParameterDeclaration',
  'TSIndexedAccessType',
  'TSTypeOperator',
]);

/** A reference that only names a type: `typeof X`, `X['k']` in an annotation. */
function isTypeOnlyRef(ref) {
  if (ref.isTypeReference) return true;
  for (let node = ref.identifier.parent; node && node.type !== 'Program'; node = node.parent) {
    if (TYPE_CONTEXTS.has(node.type)) return true;
  }
  return false;
}

/**
 * Calls `onRef(ref, importedName)` for every reference to a binding imported
 * under one of `names` from a module `matchSource` accepts. `'default'` names a
 * default import, `'*'` a namespace import. Type-only imports are skipped.
 */
function importedRefs(context, matchSource, names, onRef) {
  return function ImportDeclaration(decl) {
    if (decl.importKind === 'type') return;
    if (!matchSource(decl.source.value)) return;
    for (const spec of decl.specifiers) {
      if (spec.importKind === 'type') continue;
      let imported;
      if (spec.type === 'ImportSpecifier') imported = spec.imported.name ?? spec.imported.value;
      else if (spec.type === 'ImportDefaultSpecifier') imported = 'default';
      else imported = '*';
      if (!names.has(imported)) continue;
      for (const variable of context.sourceCode.getDeclaredVariables(spec)) {
        for (const ref of variable.references) {
          if (!isTypeOnlyRef(ref)) onRef(ref, imported);
        }
      }
    }
  };
}

/** Our own code: the shared and SDS packages, or a relative path inside one. */
const isOwnModule = (source) =>
  source === '@skkuverse/shared' ||
  source.startsWith('@skkuverse/shared/') ||
  source === '@skkuverse/sds' ||
  source.startsWith('@skkuverse/sds/') ||
  source.startsWith('.');

/** `name(…)` or `x.name(…)`. */
function calls(node, name) {
  const callee = node.callee;
  if (callee.type === 'Identifier') return callee.name === name;
  return callee.type === 'MemberExpression' && !callee.computed && callee.property.name === name;
}

/**
 * The handlers of a rule that bans imported components. `table` maps a module
 * to `{ importedName: messageId }`; a default or `Animated` import maps to
 * `{ member: messageId }` instead, so only `Animated.Text` is reported. A
 * closing tag is not counted twice.
 */
function primitiveHandlers(context, table, report) {
  const handlers = Object.entries(table).map(([source, names]) =>
    importedRefs(context, (s) => s === source, new Set(Object.keys(names)), (ref, imported) => {
      const id = ref.identifier;
      const parent = id.parent;
      if (parent.type === 'JSXClosingElement') return;
      if (parent.type === 'JSXMemberExpression' && parent.parent.type === 'JSXClosingElement') return;
      const entry = names[imported];
      if (typeof entry === 'object') {
        const isMember = (parent.type === 'JSXMemberExpression' || parent.type === 'MemberExpression') && parent.object === id;
        if (!isMember || parent.computed) return;
        const messageId = entry[parent.property.name];
        if (messageId) report({ node: parent, messageId, data: { name: `${id.name}.${parent.property.name}`, source } });
        return;
      }
      report({ node: id, messageId: entry, data: { name: id.name, source } });
    }),
  );
  return {
    ImportDeclaration(node) {
      for (const handler of handlers) handler(node);
    },
  };
}

function primitiveRule(description, table, messages) {
  return {
    meta: { type: 'problem', docs: { description }, messages, schema: [] },
    create(context) {
      return primitiveHandlers(context, table, (descriptor) => context.report(descriptor));
    },
  };
}

/** A rule that reports every node a selector matches, under its own rule ID. */
function selectorRule(description, selectors, message) {
  return {
    meta: { type: 'problem', docs: { description }, messages: { match: message }, schema: [] },
    create(context) {
      const report = (node) => context.report({ node, messageId: 'match' });
      return Object.fromEntries(selectors.map((selector) => [selector, report]));
    },
  };
}

// The scales the messages name. plugin-sds.test.mjs fails when one drifts
// from packages/shared/src/tokens/{typography,spacing,radius}.ts.
const TYPE_STEPS = { 11: 't1', 12: 't2', 13: 't3', 14: 't4', 15: 't5', 16: 't6', 17: 't7', 18: 't8', 20: 't9', 22: 't10', 26: 't11', 28: 't12', 30: 't13' };
const SPACING_STEPS = { 2: 'x0_5', 4: 'x1', 6: 'x1_5', 8: 'x2', 10: 'x2_5', 12: 'x3', 14: 'x3_5', 16: 'x4', 18: 'x4_5', 20: 'x5', 24: 'x6', 28: 'x7', 32: 'x8', 36: 'x9', 40: 'x10', 48: 'x12', 52: 'x13', 56: 'x14', 64: 'x16' };
const RADIUS_STEPS = { 2: 'r0_5', 4: 'r1', 6: 'r1_5', 8: 'r2', 10: 'r2_5', 12: 'r3', 14: 'r3_5', 16: 'r4', 20: 'r5', 24: 'r6' };

/** The step or steps nearest to an off-scale value, as `SdsSpacing.x3` (two on a tie). */
function nearestSteps(value, steps, token) {
  const sign = value < 0 ? '-' : '';
  const sizes = Object.keys(steps).map(Number);
  const distance = (size) => Math.abs(size - Math.abs(value));
  const best = Math.min(...sizes.map(distance));
  return sizes
    .filter((size) => distance(size) === best)
    .map((size) => `${sign}${token}.${steps[size]}`)
    .join(' or ');
}

// ── Color ───────────────────────────────────────────────────────────────────

const noColorLiteral = {
  meta: {
    type: 'problem',
    docs: { description: 'Reject a color spelled as a hex, rgb() or hsl() string, or a CSS color name where a color goes.' },
    messages: {
      literal:
        'A color literal ({{value}}). Read a role: useSemanticColors() in a component, createThemedStyles(({ color }) => …) in a StyleSheet. A data or illustration color takes a disable with its reason.' +
        see('COLOR-01'),
      module:
        'A color literal ({{value}}) at module scope, which can never follow the scheme. Build the sheet with createThemedStyles(({ color }) => …) and read a role. A data or illustration color takes a disable with its reason.' +
        see('COLOR-20'),
      named: "A named color ('{{value}}') where a color goes. Read a role from useSemanticColors() or createThemedStyles()." + see('COLOR-01'),
    },
    schema: [],
  },
  create(context) {
    function check(node) {
      if (isNotAValue(node)) return;
      const value = stringValue(node);
      if (value == null) return;
      const text = value.trim();
      if (HEX.test(text) || COLOR_FUNCTION.test(text)) {
        context.report({ node, messageId: inFunction(context, node) ? 'literal' : 'module', data: { value: text } });
        return;
      }
      // 'transparent' is the same in both schemes; Pressable's bg already
      // gives a surface its transparent pressed pair.
      if (NAMED_COLORS.has(text.toLowerCase())) {
        const key = owningKey(node);
        if (key && COLOR_KEY.test(key)) context.report({ node, messageId: 'named', data: { value: text } });
      }
    }
    return { Literal: check, TemplateLiteral: check };
  },
};

const noColorInString = {
  meta: {
    type: 'problem',
    docs: { description: 'Reject a color inside a longer string: injected CSS, a boxShadow, SVG markup.' },
    messages: {
      inString:
        'A color inside a string ({{snippet}}). Interpolate a role value from useSemanticColors() instead, or disable with a reason for a page that is light only.' +
        see('COLOR-01'),
    },
    schema: [],
  },
  create(context) {
    function check(node, text) {
      if (text == null) return;
      const trimmed = text.trim();
      if (HEX.test(trimmed) || COLOR_FUNCTION.test(trimmed)) return; // sds/no-color-literal's
      const match = COLOR_IN_STRING.exec(text);
      if (match) context.report({ node, messageId: 'inString', data: { snippet: match[0] } });
    }
    return {
      Literal(node) {
        if (typeof node.value === 'string' && !isNotAValue(node)) check(node, node.value);
      },
      TemplateElement(node) {
        const template = node.parent;
        if (template.type !== 'TemplateLiteral') return; // a template literal type
        if (template.expressions.length === 0) return check(template, template.quasis[0].value.cooked);
        return check(node, node.value.cooked);
      },
    };
  },
};

const noSdsColors = {
  meta: {
    type: 'problem',
    docs: { description: 'Reject a static SdsColors read, which is the light value fixed at load.' },
    messages: {
      read:
        'SdsColors.{{name}} is the light value, fixed at load. Read a role: useSemanticColors() in a component, createThemedStyles(({ color }) => …) in a StyleSheet; packages/sds/SDS.md "Moving a TDS name to a role" maps each name.' +
        see('COLOR-01'),
      sheet:
        'SdsColors.{{name}} inside a module-scope StyleSheet stays light. Turn the sheet into createThemedStyles(({ color }) => …) and read a role.' +
        see('COLOR-20'),
      module:
        'SdsColors.{{name}} captured at module scope stays light. Read a role inside the component (useSemanticColors()), or make the table a function of the theme.' +
        see('COLOR-20'),
      whole: 'SdsColors passed whole. Read a role from useSemanticColors().' + see('COLOR-01'),
    },
    schema: [],
  },
  create(context) {
    return {
      ImportDeclaration: importedRefs(context, isOwnModule, new Set(['SdsColors']), (ref) => {
        const id = ref.identifier;
        const parent = id.parent;
        if (parent.type !== 'MemberExpression' || parent.object !== id) {
          context.report({ node: id, messageId: 'whole' });
          return;
        }
        const name = parent.computed ? '[…]' : parent.property.name;
        let messageId = 'read';
        if (!inFunction(context, id)) {
          const inSheet = context.sourceCode
            .getAncestors(id)
            .some((a) => a.type === 'CallExpression' && a.callee.type === 'MemberExpression' && a.callee.object.name === 'StyleSheet');
          messageId = inSheet ? 'sheet' : 'module';
        }
        context.report({ node: parent, messageId, data: { name } });
      }),
    };
  },
};

const noStaticTheme = {
  meta: {
    type: 'problem',
    docs: { description: 'Reject the other static color doors: one-scheme role tables, palette steps, color seeds and resolvers.' },
    messages: {
      semantic: 'SdsSemanticColors.{{mode}} is fixed to one scheme. Read useSemanticColors() or createThemedStyles().' + see('COLOR-20'),
      palette:
        'SdsPalette is a palette step, not a role. Read a role from useSemanticColors(); SdsPalette.static.* is allowed for a value that is the same in both schemes.' +
        see('COLOR-01'),
      seeds: 'colorSeeds is a static light value. Read a role: useSemanticColors().bg.brandSolid and the like.' + see('COLOR-01'),
      resolve: '{{name}}() resolves colors outside the theme. Read useSemanticColors() or createThemedStyles().' + see('COLOR-20'),
    },
    schema: [],
  },
  create(context) {
    const names = new Set(['SdsSemanticColors', 'SdsPalette', 'colorSeeds', 'resolveSdsColors', 'resolveSemanticColors', 'getAdaptiveColors']);
    return {
      ImportDeclaration: importedRefs(context, isOwnModule, names, (ref, imported) => {
        const id = ref.identifier;
        const parent = id.parent;
        const member = parent.type === 'MemberExpression' && parent.object === id && !parent.computed ? parent.property.name : null;
        if (imported === 'SdsSemanticColors') {
          context.report({ node: id, messageId: 'semantic', data: { mode: member ?? '[…]' } });
        } else if (imported === 'SdsPalette') {
          // The same value in both schemes by definition: the escape for a surface that never changes.
          if (member === 'static') return;
          context.report({ node: id, messageId: 'palette' });
        } else if (imported === 'colorSeeds') {
          context.report({ node: id, messageId: 'seeds' });
        } else {
          context.report({ node: id, messageId: 'resolve', data: { name: imported } });
        }
      }),
    };
  },
};

const noUseAdaptive = {
  meta: {
    type: 'problem',
    docs: { description: 'Reject useAdaptive(), which follows the scheme but reads the TDS names.' },
    messages: { adaptive: 'useAdaptive() reads the TDS names. Read a role from useSemanticColors() or createThemedStyles().' + see('COLOR-01') },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'useAdaptive') context.report({ node, messageId: 'adaptive' });
      },
    };
  },
};

const ROLE_FAMILIES = new Set(['fg', 'bg', 'stroke']);
const SURFACE_KEY = /^(?:backgroundColor|bgColor)$/;
const LINE_KEY = /^(?:border(?:Top|Bottom|Left|Right|Start|End|Block|BlockStart|BlockEnd|Inline|InlineStart|InlineEnd)?Color|outlineColor)$/;
const TEXT_KEY = /^(?:color|textDecorationColor|placeholderTextColor)$/;
const WANT = {
  surface: { family: 'bg', what: 'a surface' },
  line: { family: 'stroke', what: 'a line' },
  text: { family: 'fg', what: 'text or an icon' },
};
/**
 * A stroke role may fill a background: a divider or hairline is a line drawn
 * as a thin View (SDS's Border), so its color is the line's.
 */
const ALSO_ALLOWED = { surface: new Set(['stroke']) };

const rolePlacement = {
  meta: {
    type: 'problem',
    docs: { description: 'Reject a role on a property of another kind: fg on a surface or line, bg on text or a line, stroke on text. A stroke role may fill a divider View.' },
    messages: {
      misplaced:
        '{{role}} is a {{family}} role on {{key}}, which draws {{what}}. Use a {{want}}.* role: fg for text and icons, bg for surfaces, stroke for lines.' +
        see('COLOR-03'),
    },
    schema: [],
  },
  create(context) {
    return {
      MemberExpression(node) {
        const group = node.object;
        if (group.type !== 'MemberExpression' || group.computed || !ROLE_FAMILIES.has(group.property.name)) return;
        const family = group.property.name;
        const key = owningKey(node);
        if (!key) return;
        const kind = SURFACE_KEY.test(key) ? 'surface' : LINE_KEY.test(key) ? 'line' : TEXT_KEY.test(key) ? 'text' : null;
        if (!kind || WANT[kind].family === family || ALSO_ALLOWED[kind]?.has(family)) return;
        const role = `${family}.${node.computed ? '[…]' : node.property.name}`;
        context.report({ node, messageId: 'misplaced', data: { role, family, key, what: WANT[kind].what, want: WANT[kind].family } });
      },
    };
  },
};

// ── Text and type ───────────────────────────────────────────────────────────

const noRnText = primitiveRule(
  "Reject React Native's Text and Animated.Text outside the SDS primitives that wrap them.",
  {
    'react-native': { Text: 'text', Animated: { Text: 'animated' } },
    'react-native-reanimated': { default: { Text: 'animated' } },
  },
  {
    text: "React Native's Text ({{name}}). Use <Txt typography fontWeight> from @skkuverse/sds." + see('TYPE-01'),
    animated: '{{name}} draws without SDS typography. Animate Txt (Animated.createAnimatedComponent(Txt)), or disable with a reason.' + see('TYPE-01'),
  },
);

const noTypeSizeLiteral = {
  meta: {
    type: 'problem',
    docs: { description: 'Reject a numeric fontSize, lineHeight or letterSpacing.' },
    messages: {
      size: '{{key}}: {{value}}{{hint}}. Use a step: <Txt typography="t…"> or ...SdsTypo.t…{Weight}, which pair the size with its line height.' + see('TYPE-01'),
    },
    schema: [],
  },
  create(context) {
    const KEYS = new Set(['fontSize', 'lineHeight', 'letterSpacing']);
    function check(prop, valueNode) {
      const key = keyName(prop);
      if (!KEYS.has(key)) return;
      const value = numberValue(valueNode);
      if (value == null) return;
      let hint = '';
      if (key === 'fontSize') hint = TYPE_STEPS[value] ? ` is step ${TYPE_STEPS[value]}` : ' is off the type scale';
      context.report({ node: valueNode, messageId: 'size', data: { key, value: String(value), hint } });
    }
    return {
      Property(node) {
        check(node, node.value);
      },
      JSXAttribute(node) {
        if (node.value && node.value.type === 'JSXExpressionContainer') check(node, node.value.expression);
      },
    };
  },
};

const noFontWeightLiteral = {
  meta: {
    type: 'problem',
    docs: { description: 'Reject a literal fontWeight in a style, which loses WantedSans on Android.' },
    messages: {
      weight: "fontWeight: {{value}} loses WantedSans on Android. Use <Txt fontWeight>, or spread ...wantedSans('<100–900>') with the step." + see('TYPE-01'),
    },
    schema: [],
  },
  create(context) {
    return {
      Property(node) {
        if (keyName(node) !== 'fontWeight') return;
        const value = node.value;
        if (value.type !== 'Literal') return;
        // A Txt prop table or a recipe's text table ({ typography: 't4',
        // fontWeight: 'bold' }) names a Txt weight, not a style.
        if (node.parent.type === 'ObjectExpression' && node.parent.properties.some((p) => keyName(p) === 'typography')) return;
        const isWeight = typeof value.value === 'number' || (typeof value.value === 'string' && /^(?:[1-9]00|bold|normal)$/.test(value.value));
        if (isWeight) context.report({ node: value, messageId: 'weight', data: { value: JSON.stringify(value.value) } });
      },
    };
  },
};

const noFontFamilyLiteral = {
  meta: {
    type: 'problem',
    docs: { description: 'Reject a literal fontFamily in a style.' },
    messages: {
      family: "fontFamily: '{{value}}'. WantedSans comes from <Txt>, SdsTypo or wantedSans(); emoji come from <Tossface>." + see('TYPE-01'),
    },
    schema: [],
  },
  create(context) {
    return {
      Property(node) {
        if (keyName(node) !== 'fontFamily') return;
        const value = stringValue(node.value);
        if (value != null) context.report({ node: node.value, messageId: 'family', data: { value } });
      },
    };
  },
};

// ── Spacing and radius ──────────────────────────────────────────────────────

const SPACING_KEY =
  /^(?:(?:padding|margin)(?:Top|Bottom|Left|Right|Horizontal|Vertical|Start|End|Block|BlockStart|BlockEnd|Inline|InlineStart|InlineEnd)?|gap|rowGap|columnGap)$/;
const RADIUS_KEY = /^border(?:(?:Top|Bottom)(?:Left|Right|Start|End)|(?:Start|End)(?:Start|End)|)Radius$/;

/**
 * A rule for numeric literals that belong on a token scale. On-scale values
 * name their step; off-scale values name the nearest one, so writing 13
 * instead of 12 does not escape the rule. `isPill` marks a radius that rounds
 * the whole side.
 */
function scaleRule({ description, keyPattern, steps, token, rule, isPill }) {
  const messages = {
    onScale: '{{key}}: {{value}} is {{step}}. Use the token.' + see(rule),
    offScale: `{{key}}: {{value}} is off the ${token} scale. Use the nearest step, {{nearest}}, or disable with a reason.` + see(rule),
  };
  if (isPill) messages.pill = '{{key}}: {{value}} draws a pill or a circle. Use SdsRadius.full.' + see(rule);
  return {
    meta: { type: 'problem', docs: { description }, messages, schema: [] },
    create(context) {
      function check(prop, valueNode) {
        const key = keyName(prop);
        if (!key || !keyPattern.test(key)) return;
        const value = numberValue(valueNode);
        if (value == null || value === 0) return;
        const size = Math.abs(value);
        const data = { key, value: String(value) };
        if (isPill && isPill(prop, size)) {
          context.report({ node: valueNode, messageId: 'pill', data });
        } else if (steps[size]) {
          context.report({ node: valueNode, messageId: 'onScale', data: { ...data, step: `${value < 0 ? '-' : ''}${token}.${steps[size]}` } });
        } else {
          context.report({ node: valueNode, messageId: 'offScale', data: { ...data, nearest: nearestSteps(value, steps, token) } });
        }
      }
      return {
        Property(node) {
          if (node.parent.type === 'ObjectExpression') check(node, node.value);
        },
        JSXAttribute(node) {
          if (node.value && node.value.type === 'JSXExpressionContainer') check(node, node.value.expression);
        },
      };
    },
  };
}

const noSpacingLiteral = scaleRule({
  description: 'Reject a non-zero numeric padding, margin or gap, on the scale or off it.',
  keyPattern: SPACING_KEY,
  steps: SPACING_STEPS,
  token: 'SdsSpacing',
  rule: 'SPACE-01',
});

const noRadiusLiteral = scaleRule({
  description: 'Reject a non-zero numeric border radius, on the scale or off it.',
  keyPattern: RADIUS_KEY,
  steps: RADIUS_STEPS,
  token: 'SdsRadius',
  rule: 'RADIUS-01',
  isPill(prop, size) {
    if (size >= 999) return true;
    // Half of a literal width or height in the same object rounds that side.
    if (prop.type !== 'Property') return false;
    return prop.parent.properties.some((sibling) => {
      const key = keyName(sibling);
      return (key === 'height' || key === 'width') && sibling.value.type === 'Literal' && sibling.value.value === size * 2;
    });
  },
});

// ── Press and primitives ────────────────────────────────────────────────────

const RN_PRESSABLES = {
  'react-native': {
    Pressable: 'pressable',
    TouchableOpacity: 'touchable',
    TouchableHighlight: 'touchable',
    TouchableWithoutFeedback: 'touchable',
    TouchableNativeFeedback: 'touchable',
    Button: 'button',
  },
  'react-native-gesture-handler': {
    Pressable: 'pressable',
    TouchableOpacity: 'touchable',
    TouchableHighlight: 'touchable',
    TouchableWithoutFeedback: 'touchable',
  },
  '@gorhom/bottom-sheet': {
    TouchableOpacity: 'touchable',
    TouchableHighlight: 'touchable',
    TouchableWithoutFeedback: 'touchable',
  },
};

const noRnPressable = {
  meta: {
    type: 'problem',
    docs: { description: 'Reject React Native Pressable, Touchable* and Button, unless the file gives the Pressable SDS feedback through usePressFeedback.' },
    messages: {
      pressable:
        "{{source}}'s Pressable. Use Pressable from @skkuverse/sds with bg=\"<role>\" (feedback=\"none\" for a bare hit area), or call usePressFeedback in this file for motion on another element." +
        see('PRESS-01'),
      touchable: '{{name}} dims with opacity. Use Pressable from @skkuverse/sds with bg="<role>".' + see('PRESS-01'),
      button: "React Native's Button. Use Button from @skkuverse/sds." + see('PRESS-01'),
    },
    schema: [],
  },
  create(context) {
    // SDS.md "Touch on one element, motion on another": RN's Pressable is the
    // trigger and usePressFeedback the motion, so a file that calls it may
    // use RN's Pressable. Touchables stay banned either way.
    const pending = [];
    let givesFeedback = false;
    return {
      ...primitiveHandlers(context, RN_PRESSABLES, (descriptor) => pending.push(descriptor)),
      CallExpression(node) {
        if (calls(node, 'usePressFeedback')) givesFeedback = true;
      },
      'Program:exit'() {
        for (const descriptor of pending) {
          if (!(givesFeedback && descriptor.messageId === 'pressable')) context.report(descriptor);
        }
      },
    };
  },
};

/** `pressed`, `!pressed`, `state.pressed`, `a && pressed`. */
function mentionsPressed(node) {
  if (!node) return false;
  if (node.type === 'Identifier') return node.name === 'pressed';
  if (node.type === 'MemberExpression') return !node.computed && node.property.name === 'pressed';
  if (node.type === 'UnaryExpression') return mentionsPressed(node.argument);
  if (node.type === 'LogicalExpression') return mentionsPressed(node.left) || mentionsPressed(node.right);
  return false;
}

const noPressOpacity = {
  meta: {
    type: 'problem',
    docs: { description: 'Reject press feedback built from opacity or a hand-tuned scale, and activeOpacity.' },
    messages: {
      opacity:
        'Opacity as press feedback. Use Pressable from @skkuverse/sds with bg="<role>": a press changes the surface and shrinks by a fixed distance, and opacity is for disabled only.' +
        see('PRESS-02'),
      scale: 'A hand-built press scale. Pressable from @skkuverse/sds and usePressFeedback shrink by a fixed distance.' + see('PRESS-07'),
      active: 'activeOpacity is opacity as press feedback. Use Pressable from @skkuverse/sds with bg="<role>".' + see('PRESS-02'),
    },
    schema: [],
  },
  create(context) {
    return {
      Property(node) {
        const key = keyName(node);
        if ((key === 'opacity' || key === 'scale') && node.value.type === 'ConditionalExpression' && mentionsPressed(node.value.test)) {
          context.report({ node, messageId: key });
        }
      },
      JSXAttribute(node) {
        if (keyName(node) === 'activeOpacity') context.report({ node, messageId: 'active' });
      },
    };
  },
};

const noRnPrimitive = primitiveRule(
  'Reject React Native primitives that have an SDS counterpart.',
  { 'react-native': { ActivityIndicator: 'loader', Switch: 'switch' } },
  {
    loader: 'ActivityIndicator. Use Loader from @skkuverse/sds.' + see('LOAD-03'),
    switch: "React Native's Switch. Use Switch from @skkuverse/sds (checked, onCheckedChange)." + see('SEL-01'),
  },
);

const noVectorIcons = {
  meta: {
    type: 'problem',
    docs: { description: 'Reject icon sets other than phosphor.' },
    messages: { icons: '{{source}}. Draw UI icons from phosphor-react-native (the *Icon components).' + see('ICON-01') },
    schema: [],
  },
  create(context) {
    const check = (node) => {
      const source = node.source && node.source.value;
      if (typeof source === 'string' && /^(?:@expo\/vector-icons|react-native-vector-icons)(?:\/|$)/.test(source)) {
        context.report({ node, messageId: 'icons', data: { source } });
      }
    };
    return { ImportDeclaration: check, ExportNamedDeclaration: check, ExportAllDeclaration: check };
  },
};

// ── Surfaces ────────────────────────────────────────────────────────────────

const noRawShadow = {
  meta: {
    type: 'problem',
    docs: { description: 'Reject shadow values spelled out by hand.' },
    messages: { shadow: '{{key}} spelled out. Use SdsShadows.' + see('ELEV-04') },
    schema: [],
  },
  create(context) {
    const KEYS = new Set(['shadowOpacity', 'shadowRadius', 'shadowOffset', 'elevation', 'boxShadow']);
    return {
      Property(node) {
        const key = keyName(node);
        if (!KEYS.has(key) || node.parent.type !== 'ObjectExpression') return;
        const value = node.value;
        if (key === 'elevation' && numberValue(value) === 0) return;
        if (numberValue(value) != null || value.type === 'ObjectExpression' || stringValue(value) != null || value.type === 'TemplateLiteral') {
          context.report({ node, messageId: 'shadow', data: { key } });
        }
      },
    };
  },
};

const GLASS_ELEMENT = /^Glass(?:[A-Z]\w*)?$/;

/** The name a JSX element is written with: `GlassChip`, or `View` for `Animated.View`. */
function jsxElementName(name) {
  if (name.type === 'JSXIdentifier') return name.name;
  if (name.type === 'JSXMemberExpression') return name.property.name;
  return null;
}

/** The first `Glass*` element written anywhere inside `node`, or null. */
function findGlassElement(node) {
  if (!node || typeof node.type !== 'string') return null;
  if (node.type === 'JSXOpeningElement') {
    const name = jsxElementName(node.name);
    if (name && GLASS_ELEMENT.test(name)) return name;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent') continue;
    const children = Array.isArray(value) ? value : [value];
    for (const child of children) {
      if (child && typeof child === 'object') {
        const found = findGlassElement(child);
        if (found) return found;
      }
    }
  }
  return null;
}

const noEnteringOverGlass = {
  meta: {
    type: 'problem',
    docs: { description: 'Reject a Reanimated `entering` animation on an element that has a Glass element written inside it.' },
    messages: {
      entering:
        '`entering` over {{name}}. Liquid Glass mounted under a mount animation can draw nothing until its screen is covered and shown again. Mount the glass plainly: drop `entering` and keep `exiting`.' +
        see('MOTION-04'),
    },
    schema: [],
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'entering') return;
        const element = node.parent.parent;
        if (element.type !== 'JSXElement') return;
        const name = findGlassElement(element);
        if (name) context.report({ node, messageId: 'entering', data: { name } });
      },
    };
  },
};

const noFixedScheme = {
  meta: {
    type: 'problem',
    docs: { description: 'Reject a light or dark scheme fixed in a string prop.' },
    messages: { scheme: '{{key}}="{{value}}" fixes the scheme. Derive it from useResolvedScheme() from @skkuverse/sds.' + see('COLOR-20') },
    schema: [],
  },
  create(context) {
    const KEYS = new Set(['style', 'barStyle', 'tint', 'blurEffect', 'glassEffectStyle', 'colorScheme', 'userInterfaceStyle', 'keyboardAppearance', 'indicatorStyle', 'blurType']);
    const VALUES = new Set(['light', 'dark', 'light-content', 'dark-content', 'extraLight', 'black', 'white']);
    function check(prop, valueNode) {
      const key = keyName(prop);
      if (!KEYS.has(key)) return;
      const value = stringValue(valueNode);
      if (value == null || !(VALUES.has(value) || /Material(?:Light|Dark)$/.test(value))) return;
      context.report({ node: valueNode, messageId: 'scheme', data: { key, value } });
    }
    return {
      JSXAttribute(node) {
        if (node.value) check(node, node.value.type === 'JSXExpressionContainer' ? node.value.expression : node.value);
      },
      // An object's `style` key is a haptic or a font style, not a scheme.
      Property(node) {
        if (node.parent.type === 'ObjectExpression' && keyName(node) !== 'style') check(node, node.value);
      },
    };
  },
};

const PART_KINDS = [
  { pattern: /Chips?$/, kind: 'chip', target: 'Chip', parts: ['Chip'], rule: 'CHIP-01' },
  {
    pattern: /(?:Banner|Callout|Notice[A-Z]?Bar|Hint)$/,
    kind: 'banner',
    target: 'Callout, ActionableCallout or DismissibleCallout',
    parts: ['Callout', 'ActionableCallout', 'DismissibleCallout'],
    rule: 'CALLOUT-07',
  },
  {
    pattern: /(?:Empty|EmptyState|EmptyView|ErrorState|ErrorView|ErrorFallback|NoResults?)$/,
    kind: 'result state',
    target: 'ResultSection',
    parts: ['ResultSection'],
    rule: 'RESULT-01',
  },
];

const noHandbuiltPart = {
  meta: {
    type: 'problem',
    docs: { description: 'Flag a component named like a hand-built chip, banner or result state when the file does not use the SDS part (a heuristic tripwire).' },
    messages: {
      part: '{{name}} looks like a hand-built {{kind}}. Use {{target}} from @skkuverse/sds, or disable with the reason it cannot. See {{rule}} in packages/sds/SDS.md "Lint rules".',
      retry:
        "{{name}} renders a retry label by hand, which is an error state built by hand. Use ResultSection from @skkuverse/sds with primaryActionProps, or disable with the reason it cannot." +
        see('RESULT-01'),
    },
    schema: [],
  },
  create(context) {
    const imported = new Set();
    const found = [];
    function check(id) {
      if (!id || id.type !== 'Identifier' || !/^[A-Z]/.test(id.name)) return;
      const kind = PART_KINDS.find(({ pattern }) => pattern.test(id.name));
      if (kind) found.push({ node: id, ...kind, name: id.name });
    }
    return {
      ImportDeclaration(node) {
        if (node.source.value !== '@skkuverse/sds') return;
        for (const spec of node.specifiers) {
          if (spec.type === 'ImportSpecifier') imported.add(spec.imported.name ?? spec.imported.value);
        }
      },
      FunctionDeclaration(node) {
        check(node.id);
      },
      VariableDeclarator(node) {
        const init = node.init;
        if (!init) return;
        // `const X = memo(() => …)` / `forwardRef(function …)` as well as a bare function.
        const fn = init.type === 'CallExpression' && init.arguments[0] && /Function|Arrow/.test(init.arguments[0].type) ? init.arguments[0] : init;
        if (fn.type === 'ArrowFunctionExpression' || fn.type === 'FunctionExpression') check(node.id);
      },
      // `{t('common.retry')}` as a JSX child: ResultSection takes the label as primaryActionProps.
      CallExpression(node) {
        if (node.callee.type !== 'Identifier' || !/^(?:t|translate)$/.test(node.callee.name)) return;
        const label = node.arguments.find((a) => a.type === 'Literal' && typeof a.value === 'string');
        if (!label || !/(?:^|\.)retry$/.test(label.value)) return;
        if (node.parent.type === 'JSXExpressionContainer' && node.parent.parent.type === 'JSXElement') {
          context.report({ node, messageId: 'retry', data: { name: `{${node.callee.name}('${label.value}')}` } });
        }
      },
      'Program:exit'() {
        // A wrapper over the SDS part is the intended shape (a HintBanner that renders <Callout>).
        for (const f of found) {
          if (!f.parts.some((part) => imported.has(part))) {
            context.report({ node: f.node, messageId: 'part', data: { name: f.name, kind: f.kind, target: f.target, rule: f.rule } });
          }
        }
      },
    };
  },
};

// ── Accessibility ───────────────────────────────────────────────────────────

/**
 * The `accessibilityRole` values React Native's Android view manager accepts,
 * read from the installed copy of ReactAccessibilityDelegate.kt: its
 * `AccessibilityRole.fromValue` throws on any other string, and the throw
 * tears the React host down, which blanks the app. The JS types accept more
 * (`tabbar` is iOS's), so the compiler does not catch it. Read rather than
 * copied, so a React Native bump moves the list with it; a file that no
 * longer parses fails the lint run instead of passing everything.
 */
function readAndroidRoles() {
  const { readFileSync } = require('node:fs');
  const { dirname: dir, join: joinPath, resolve: resolvePath } = require('node:path');
  const mobile = resolvePath(dir(require.resolve('./plugin-sds.cjs')), '../../apps/mobile');
  const rnRoot = dir(require.resolve('react-native/package.json', { paths: [mobile] }));
  const file = joinPath(rnRoot, 'ReactAndroid/src/main/java/com/facebook/react/uimanager/ReactAccessibilityDelegate.kt');
  const source = readFileSync(file, 'utf8');
  const body = /enum class AccessibilityRole\s*\{([^;}]*);/.exec(source);
  if (!body) throw new Error(`sds/android-accessibility-role: no AccessibilityRole enum in ${file}`);
  const names = body[1]
    .replace(/\/\/.*$/gm, '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  if (names.length === 0 || !names.every((name) => /^[A-Z][A-Z_]*$/.test(name))) {
    throw new Error(`sds/android-accessibility-role: unexpected AccessibilityRole entries in ${file}`);
  }
  return new Set(names.map((name) => name.toLowerCase()));
}

const ANDROID_ROLES = readAndroidRoles();

/** `Platform.OS`, read by name. */
function isPlatformOs(node) {
  return (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.object.type === 'Identifier' &&
    node.object.name === 'Platform' &&
    node.property.type === 'Identifier' &&
    node.property.name === 'OS'
  );
}

/**
 * For a `Platform.OS === 'x'` (or `!==`) test, whether each branch of the
 * conditional can run on Android: `[consequent, alternate]`. Any other test
 * leaves both branches reachable there.
 */
function androidBranches(test) {
  if (test.type !== 'BinaryExpression' || !['===', '!==', '==', '!='].includes(test.operator)) return [true, true];
  const [os, other] = isPlatformOs(test.left) ? [test.left, test.right] : [test.right, test.left];
  if (!isPlatformOs(os)) return [true, true];
  const value = stringValue(other);
  if (value === null) return [true, true];
  const equal = test.operator.startsWith('=');
  const onAndroidWhenTrue = equal ? value === 'android' : value !== 'android';
  return [onAndroidWhenTrue, !onAndroidWhenTrue];
}

/** `Platform.select({ … })`, read by name. */
function isPlatformSelect(node) {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.object.type === 'Identifier' &&
    node.callee.object.name === 'Platform' &&
    node.callee.property.type === 'Identifier' &&
    node.callee.property.name === 'select'
  );
}

/** The Platform.select keys whose value can reach an Android view. */
const ANDROID_SELECT_KEYS = new Set(['android', 'native', 'default']);

const androidAccessibilityRole = {
  meta: {
    type: 'problem',
    docs: { description: 'Reject an accessibilityRole that React Native on Android throws on.' },
    messages: {
      role:
        "accessibilityRole '{{value}}' is not a role Android accepts: React Native's ReactAccessibilityDelegate.kt throws on it when the view mounts, and the app goes blank. Use a role from its AccessibilityRole list ('tablist' for a tab bar), or give iOS its own value behind Platform.OS === 'ios' or Platform.select({ ios, android })." +
        see('A11Y-07'),
    },
    schema: [],
  },
  create(context) {
    /** Reports every string that can reach an Android view's accessibilityRole. */
    function check(node) {
      if (!node) return;
      switch (node.type) {
        case 'JSXExpressionContainer':
        case 'TSAsExpression':
        case 'TSSatisfiesExpression':
        case 'TSNonNullExpression':
          check(node.expression);
          return;
        case 'ConditionalExpression': {
          const [consequent, alternate] = androidBranches(node.test);
          if (consequent) check(node.consequent);
          if (alternate) check(node.alternate);
          return;
        }
        case 'LogicalExpression':
          check(node.left);
          check(node.right);
          return;
        case 'CallExpression':
          if (!isPlatformSelect(node) || node.arguments[0]?.type !== 'ObjectExpression') return;
          for (const prop of node.arguments[0].properties) {
            const key = keyName(prop);
            if (key && ANDROID_SELECT_KEYS.has(key)) check(prop.value);
          }
          return;
        default: {
          const value = stringValue(node);
          if (value !== null && !ANDROID_ROLES.has(value.toLowerCase())) {
            context.report({ node, messageId: 'role', data: { value } });
          }
        }
      }
    }
    return {
      JSXAttribute(node) {
        if (node.name.type === 'JSXIdentifier' && node.name.name === 'accessibilityRole') check(node.value);
      },
      Property(node) {
        if (keyName(node) === 'accessibilityRole') check(node.value);
      },
    };
  },
};

// ── SDS API ─────────────────────────────────────────────────────────────────

const ROLE_TYPES = '/^(?:SdsColor|FgColorName|BgColorName|StrokeColorName|PressableBgToken)$/';

const noRoleCast = selectorRule(
  'Reject a type assertion to a role type in app code.',
  [
    `TSAsExpression > TSTypeReference.typeAnnotation[typeName.name=${ROLE_TYPES}]`,
    `TSAsExpression > TSArrayType.typeAnnotation > TSTypeReference[typeName.name=${ROLE_TYPES}]`,
    `TSTypeAssertion > TSTypeReference.typeAnnotation[typeName.name=${ROLE_TYPES}]`,
  ],
  'A cast to a role type skips the check the type exists for. Pick a role, or vouch for a data color with asSdsColor() and a reason.' + see('COLOR-01'),
);

const recipeTypeImports = selectorRule(
  'Reject a value import in a recipe module.',
  ["ImportDeclaration[importKind='value']"],
  'A recipe imports types only, so its node --test can load it. Take tokens from the RecipeTheme argument instead. See packages/sds/SDS.md "Recipes".',
);

// ── Meta ────────────────────────────────────────────────────────────────────

/** The rule IDs a directive lists, or [] when it lists none (every rule). */
function listedRules(value) {
  return value
    .split(',')
    .map((name) => name.trim().replace(/^(['"]?)(.*)\1$/s, '$2'))
    .filter(Boolean);
}

/** The plugins whose rules run over a ratchet (ADR 0016): switched off only in the listed forms. */
const GOVERNED = /^(?:sds|arch)\//;

/** An inline config comment (`/* eslint sds/x: off *\/`) that configures a governed rule. */
const INLINE_GOVERNED_CONFIG = /^\s*eslint\s(?:[^]*?[\s,{])?["']?(?:sds|arch)\/[\w-]+["']?\s*:/;

const RATCHET_HOW_TO = ' See docs/how-to/work-under-the-lint-ratchet.md.';

/**
 * Every disable says why, and a governed rule (`sds/*`, `arch/*`) is switched
 * off in three ways only: the rule's `files` scope in eslint.config.js, an
 * entry in scripts/eslint/sds-exceptions.cjs (`sds/*`), or a line-level
 * disable naming the rule with a reason after `--`. This rule rejects:
 *   - any disable with no reason, or one shorter than MIN_REASON;
 *   - a block or file-wide `eslint-disable` of a governed rule, with or without a reason;
 *   - an inline config comment that sets a governed rule.
 * A directive that lists no rules switches off every rule, governed ones
 * included, so it counts as governed, and a line-level one must name its rules.
 *
 * The directives come from ESLint's own parser (`getDisableDirectives`), so a
 * comment ESLint ignores, such as `// eslint-disable` written as a line
 * comment, is ignored here too. A comment that switches this rule itself off
 * silences its own report here; scripts/eslint/disable-guard.mjs runs the rule
 * again with inline config off, where nothing can.
 */
const requireDisableReason = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require a reason on every disable, and forbid every inline way but a line-level disable to switch off an sds/* or arch/* rule.',
    },
    messages: {
      reason:
        'Disabling {{rules}} needs a reason of at least {{min}} characters: `// eslint-disable-next-line {{rules}} -- <why>`.' + RATCHET_HOW_TO,
      unnamed:
        'This disable switches off every rule, sds/* and arch/* included. Name the rule and give a reason: `// eslint-disable-next-line <rule> -- <why>`.' +
        RATCHET_HOW_TO,
      block:
        'A block or file-wide disable of {{rules}}. Disable one line with a reason; an sds/* rule may instead take an entry in scripts/eslint/sds-exceptions.cjs.' +
        RATCHET_HOW_TO,
      inline:
        'An inline config comment that sets an sds/* or arch/* rule. Disable one line with a reason; an sds/* rule may instead take an entry in scripts/eslint/sds-exceptions.cjs.' +
        RATCHET_HOW_TO,
    },
    schema: [],
  },
  create(context) {
    const { sourceCode } = context;
    return {
      Program() {
        for (const directive of sourceCode.getDisableDirectives().directives) {
          if (directive.type === 'enable') continue;
          const listed = listedRules(directive.value);
          const governed = listed.filter((rule) => GOVERNED.test(rule));
          const { loc } = directive.node;
          if (listed.length === 0) {
            if (directive.type === 'disable') context.report({ loc, messageId: 'block', data: { rules: 'every rule' } });
            else context.report({ loc, messageId: 'unnamed' });
          } else if (directive.type === 'disable' && governed.length > 0) {
            context.report({ loc, messageId: 'block', data: { rules: governed.join(', ') } });
          } else if (directive.justification.trim().length < MIN_REASON) {
            context.report({ loc, messageId: 'reason', data: { rules: listed.join(', '), min: String(MIN_REASON) } });
          }
        }
        for (const comment of sourceCode.getInlineConfigNodes()) {
          if (comment.type === 'Block' && INLINE_GOVERNED_CONFIG.test(comment.value)) {
            context.report({ loc: comment.loc, messageId: 'inline' });
          }
        }
      },
    };
  },
};

module.exports = {
  meta: { name: 'eslint-plugin-sds', version: '0.0.0' },
  /** The scales the messages name, exported for the test that pins them to the tokens. */
  scales: { type: TYPE_STEPS, spacing: SPACING_STEPS, radius: RADIUS_STEPS },
  /** The roles sds/android-accessibility-role allows, exported for the test that pins the parse. */
  androidRoles: ANDROID_ROLES,
  rules: {
    // Color
    'no-color-literal': noColorLiteral,
    'no-color-in-string': noColorInString,
    'no-sds-colors': noSdsColors,
    'no-static-theme': noStaticTheme,
    'no-use-adaptive': noUseAdaptive,
    'role-placement': rolePlacement,
    // Text and type
    'no-rn-text': noRnText,
    'no-type-size-literal': noTypeSizeLiteral,
    'no-font-weight-literal': noFontWeightLiteral,
    'no-font-family-literal': noFontFamilyLiteral,
    // Spacing and radius
    'no-spacing-literal': noSpacingLiteral,
    'no-radius-literal': noRadiusLiteral,
    // Press and primitives
    'no-rn-pressable': noRnPressable,
    'no-press-opacity': noPressOpacity,
    'no-rn-primitive': noRnPrimitive,
    'no-vector-icons': noVectorIcons,
    // Surfaces
    'no-raw-shadow': noRawShadow,
    'no-fixed-scheme': noFixedScheme,
    'no-entering-over-glass': noEnteringOverGlass,
    'no-handbuilt-part': noHandbuiltPart,
    // Accessibility
    'android-accessibility-role': androidAccessibilityRole,
    // SDS API
    'no-role-cast': noRoleCast,
    'recipe-type-imports': recipeTypeImports,
    // Meta
    'require-disable-reason': requireDisableReason,
  },
};
