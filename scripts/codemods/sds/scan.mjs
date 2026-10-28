#!/usr/bin/env node
// The SDS migration scanner: one pass over the UI code with the TypeScript
// compiler API that records every site the migration moves, with what a
// codemod needs to rewrite it. Moved from the inventory research
// (an earlier inventory script); the
// mapping it fed now lives in migration-map.json.
//
//   node scripts/codemods/sds/scan.mjs                 counts per category
//   node scripts/codemods/sds/scan.mjs --json <out>    every record as JSON
//   node scripts/codemods/sds/scan.mjs --compare       per rule against eslint-suppressions.json
//   … [paths]                                          only these files
//
// Read-only. What it resolves, from the syntax tree rather than by name:
//
// - import bindings: a component or token is found by what it was imported
//   as and from where, so `Text as RNText`, `SdsColors as C` and a name from
//   a multi-name import are caught, and a local `Text` or react-native-svg's
//   is not. Type-only imports are skipped.
// - same-file styles: `styles.key` resolves to its entry in a StyleSheet.create
//   or createThemedStyles in the same file, through arrays, conditionals,
//   `&&`, `??` and StyleSheet.flatten/compose.
// - the consumer of a value (which key or prop receives it) and its scope
//   (module StyleSheet, component, hook, helper, class).
//
// What it leaves unresolved, recorded as such so a codemod leaves it alone:
// a style imported from another file, a style built by a call, a spread.
//
// --compare: the documented gaps. The scanner counts by syntax site and the
// lint rules (scripts/eslint/plugin-sds.cjs) by their own definition, so the
// totals agree except for these differences, each of which the comparison
// reports by file:
//
// 1. no-rn-text counts every reference to the binding (Animated.createAnimatedComponent(Text),
//    a component table); the scanner counts JSX elements.
// 2. no-color-literal allows 'transparent' and reads a CSS color name only
//    directly under a color key; the scanner records 'transparent' and a name
//    passed through a call (`toCssColor(c, 'black')`) as color literals too.
// 3. no-type-size-literal and the scale rules also read JSX attributes
//    (`<Tossface fontSize={20}>`, `gap={8}`); the scanner reads object properties.
// 4. no-type-size-literal reads a { typography, … } prop table too; the scanner
//    skips it as a Txt prop config, not a style.
// 5. no-rn-pressable reports Touchable* from @gorhom/bottom-sheet and RN's
//    Button, and lets a file that calls usePressFeedback keep RN's Pressable;
//    the scanner applies both, so a remaining gap is a reference outside JSX.
// 6. Exceptions: entries in scripts/eslint/sds-exceptions.cjs and line-level
//    disables are dropped from the scan before comparing.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

import { colorIndex, hex6, parseColor } from './color.mjs';
import { scanFiles } from './files.mjs';
import { loadTokens, repoRoot } from './tokens.mjs';

const FUNC_KINDS = new Set([
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.FunctionExpression,
  ts.SyntaxKind.ArrowFunction,
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.Constructor,
  ts.SyntaxKind.GetAccessor,
  ts.SyntaxKind.SetAccessor,
]);
const SPACING_KEYS = /^(padding|margin)(Top|Bottom|Left|Right|Horizontal|Vertical|Start|End|Block|BlockStart|BlockEnd|Inline|InlineStart|InlineEnd)?$|^(gap|rowGap|columnGap)$/;
const RADIUS_KEYS = /^border(?:(?:Top|Bottom)(?:Left|Right|Start|End)|(?:Start|End)(?:Start|End)|)Radius$/;
const TYPO_KEYS = new Set(['fontSize', 'lineHeight', 'fontWeight', 'fontFamily', 'letterSpacing']);
const SHADOW_KEYS = new Set(['shadowColor', 'shadowOffset', 'shadowOpacity', 'shadowRadius', 'elevation', 'boxShadow']);
const TOKEN_APIS = new Set(['SdsSpacing', 'SdsRadius', 'SdsTypo', 'SdsShadows', 'SdsDuration', 'SdsCurves', 'SdsTypeScale']);
const SHEET_RE = /sheet|modal|dialog|popup|popover|menu|floating|overlay/i;
const PRIMITIVES = ['Switch', 'ActivityIndicator', 'TextInput', 'Modal', 'RefreshControl', 'TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback', 'StatusBar'];
/** What sds/no-rn-pressable bans, by module. */
const PRESSABLES = {
  'react-native': ['Pressable', 'TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback', 'TouchableNativeFeedback', 'Button'],
  'react-native-gesture-handler': ['Pressable', 'TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback'],
  '@gorhom/bottom-sheet': ['TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback'],
};

/** Our own modules, where SdsColors and the tokens come from (as sds/no-sds-colors reads them). */
export const isOwnModule = (mod) => mod === '@skkuverse/shared' || mod.startsWith('@skkuverse/shared/') || mod === '@skkuverse/sds' || mod.startsWith('@skkuverse/sds/') || mod.startsWith('.');

export const CATEGORIES = [
  'rnText', 'colorLit', 'colorEmbedded', 'typoLit', 'spacing', 'tokenUse', 'press', 'primitives', 'sdsColors', 'otherColorApi',
  'sheets', 'sdsOverride', 'inlineStyle', 'shadow', 'adaptive', 'semanticUse', 'schemeLiteral', 'durations', 'pressables',
  'disabledOpacity', 'importEdges',
];

function areaOf(f) {
  if (f.startsWith('packages/sds/')) return 'sds';
  if (f.startsWith('apps/mobile/app/')) return 'app';
  return 'src';
}

/** Rule IDs disabled per line by `eslint-disable-next-line` / `eslint-disable-line`, and for the whole file. */
function disabledRules(lines) {
  const byLine = new Map();
  const whole = new Set();
  const add = (line, rules) => {
    if (!byLine.has(line)) byLine.set(line, new Set());
    for (const r of rules) byLine.get(line).add(r);
  };
  const rulesOf = (s) => s.split('--')[0].split(',').map((r) => r.trim()).filter(Boolean);
  lines.forEach((text, i) => {
    let m = /eslint-disable-next-line\s+([^*\n]+)/.exec(text);
    if (m) add(i + 2, rulesOf(m[1]));
    m = /eslint-disable-line\s+([^*\n]+)/.exec(text);
    if (m) add(i + 1, rulesOf(m[1]));
    m = /\/\*\s*eslint-disable\s+([^*]+)\*\//.exec(text);
    if (m) for (const r of rulesOf(m[1])) whole.add(r);
  });
  return { isDisabled: (line, rule) => whole.has(rule) || !!byLine.get(line)?.has(rule) };
}

let defaultContext;
/** The token tables and color lookups the scanner needs, loaded once. */
export function scanContext() {
  if (!defaultContext) {
    const tokens = loadTokens();
    defaultContext = { tokens, colors: colorIndex(tokens) };
  }
  return defaultContext;
}

/**
 * Every record in one file's source. `file` is repository-relative; it sets
 * the area and the TSX parse. Returns `{ [category]: record[] }`; a record
 * carries `file`, `line`, `area`, `snippet` and its category's fields.
 */
export function scanSource(file, text, context = scanContext()) {
  const { colors } = context;
  const R = Object.fromEntries(CATEGORIES.map((c) => [c, []]));
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const lines = text.split('\n');
  const area = areaOf(file);
  const { isDisabled } = disabledRules(lines);
  const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const snip = (n) => (lines[lineOf(n) - 1] || '').trim().replace(/\s+/g, ' ').slice(0, 170);
  const textOf = (n) => n.getText(sf).replace(/\s+/g, ' ');
  const base = (n) => ({ file, line: lineOf(n), area, snippet: snip(n), start: n.getStart(sf), end: n.getEnd() });

  // ── import bindings ──
  const imports = new Map(); // local name → { mod, imported } ('default', '*' or the exported name)
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause || st.importClause.isTypeOnly) continue;
    const mod = st.moduleSpecifier.text;
    const ic = st.importClause;
    if (ic.name) imports.set(ic.name.text, { mod, imported: 'default' });
    if (ic.namedBindings) {
      if (ts.isNamespaceImport(ic.namedBindings)) imports.set(ic.namedBindings.name.text, { mod, imported: '*' });
      else for (const el of ic.namedBindings.elements) if (!el.isTypeOnly) imports.set(el.name.text, { mod, imported: (el.propertyName || el.name).text });
    }
  }
  /** The own-module export a local identifier is bound to (`SdsColors`), or null. */
  const ownExport = (name) => {
    const b = imports.get(name);
    return b && isOwnModule(b.mod) ? b.imported : null;
  };
  // import graph edges (dead-file detection)
  (function edges(n) {
    let spec = null;
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) spec = n.moduleSpecifier.text;
    if (ts.isCallExpression(n) && n.arguments.length && ts.isStringLiteral(n.arguments[0]) && (n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && n.expression.text === 'require'))) spec = n.arguments[0].text;
    if (spec) R.importEdges.push({ from: file, spec });
    ts.forEachChild(n, edges);
  })(sf);
  const isSdsMod = (mod) =>
    mod === '@skkuverse/sds' ||
    (file.startsWith('packages/sds/src/components') && mod.startsWith('.') && !/core|foundation|utils/.test(mod)) ||
    (file.startsWith('packages/sds/src') && /\.\.\/components\//.test(mod));

  // ── style registries ──
  const sheets = new Map(); // var → { entries, moduleLevel, line, themed, exported }
  const localObjects = new Map();
  function propName(n) {
    if (!n) return null;
    if (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n) || ts.isPrivateIdentifier(n)) return n.text;
    return null;
  }
  function unwrap(n) {
    while (n && (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isNonNullExpression(n) || ts.isSatisfiesExpression(n))) n = n.expression;
    return n;
  }
  function objEntries(obj) {
    const m = new Map();
    if (!obj || !ts.isObjectLiteralExpression(obj)) return m;
    for (const p of obj.properties) {
      if (ts.isPropertyAssignment(p)) {
        const k = propName(p.name);
        if (k) m.set(k, unwrap(p.initializer));
      }
    }
    return m;
  }
  function isModuleLevel(n) {
    for (let p = n.parent; p; p = p.parent) if (FUNC_KINDS.has(p.kind)) return false;
    return true;
  }
  const calleeText = (call) => call.expression.getText(sf);
  const isStyleSheetCreate = (call) => {
    const e = call.expression;
    return ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression) && e.name.text === 'create' && imports.get(e.expression.text)?.imported === 'StyleSheet';
  };
  const isThemedFactory = (call) => ts.isIdentifier(call.expression) && ownExport(call.expression.text) === 'createThemedStyles';

  const themedHooks = new Map(); // useStyles → entries
  (function visitDecl(n) {
    if (ts.isVariableDeclaration(n) && n.initializer && ts.isIdentifier(n.name)) {
      const init = unwrap(n.initializer);
      if (ts.isCallExpression(init)) {
        if (isStyleSheetCreate(init) && init.arguments[0]) {
          const stmt = n.parent && n.parent.parent;
          const exported = !!(stmt && ts.canHaveModifiers(stmt) && ts.getModifiers(stmt)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));
          sheets.set(n.name.text, { entries: objEntries(unwrap(init.arguments[0])), moduleLevel: isModuleLevel(n), line: lineOf(n), themed: false, exported });
        } else if (isThemedFactory(init) && init.arguments[0]) {
          const f = init.arguments[0];
          let body = f.body && unwrap(f.body);
          if (body && ts.isBlock(body)) {
            const ret = body.statements.find(ts.isReturnStatement);
            body = ret && unwrap(ret.expression);
          }
          themedHooks.set(n.name.text, objEntries(body));
        }
      } else if (ts.isObjectLiteralExpression(init)) localObjects.set(n.name.text, init);
    }
    ts.forEachChild(n, visitDecl);
  })(sf);
  // const styles = useStyles()
  (function bindThemed(n) {
    if (ts.isVariableDeclaration(n) && n.initializer && ts.isIdentifier(n.name)) {
      const init = unwrap(n.initializer);
      if (ts.isCallExpression(init) && ts.isIdentifier(init.expression) && themedHooks.has(init.expression.text)) {
        sheets.set(n.name.text, { entries: themedHooks.get(init.expression.text), moduleLevel: false, themed: true, line: lineOf(n) });
      }
    }
    ts.forEachChild(n, bindThemed);
  })(sf);

  /** The object literals a style expression resolves to, or `{ unresolved }` for each part it cannot follow. */
  function resolveStyle(expr, depth = 0) {
    expr = unwrap(expr);
    if (!expr || depth > 8) return [];
    if (ts.isObjectLiteralExpression(expr)) return [{ obj: expr, ref: 'inline' }];
    if (ts.isArrayLiteralExpression(expr)) return expr.elements.flatMap((e) => resolveStyle(ts.isSpreadElement(e) ? e.expression : e, depth + 1));
    if (ts.isConditionalExpression(expr)) return [...resolveStyle(expr.whenTrue, depth + 1), ...resolveStyle(expr.whenFalse, depth + 1)];
    if (ts.isBinaryExpression(expr)) {
      const op = expr.operatorToken.kind;
      if (op === ts.SyntaxKind.AmpersandAmpersandToken) return resolveStyle(expr.right, depth + 1);
      if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) return [...resolveStyle(expr.left, depth + 1), ...resolveStyle(expr.right, depth + 1)];
      return [];
    }
    if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression)) {
      const s = sheets.get(expr.expression.text);
      if (s) {
        const o = s.entries.get(expr.name.text);
        return o ? [{ obj: o, ref: `${expr.expression.text}.${expr.name.text}`, sheet: expr.expression.text }] : [{ unresolved: textOf(expr) }];
      }
      return [{ unresolved: textOf(expr) }];
    }
    if (ts.isIdentifier(expr)) {
      if (expr.text === 'undefined') return [];
      const o = localObjects.get(expr.text);
      return o ? [{ obj: o, ref: expr.text }] : [{ unresolved: expr.text }];
    }
    if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
      const b = unwrap(expr.body);
      if (ts.isBlock(b)) return b.statements.filter(ts.isReturnStatement).flatMap((r) => resolveStyle(r.expression, depth + 1));
      return resolveStyle(b, depth + 1);
    }
    if (ts.isCallExpression(expr)) {
      const c = calleeText(expr);
      if (/StyleSheet\.(flatten|compose)/.test(c)) return expr.arguments.flatMap((a) => resolveStyle(a, depth + 1));
      return [{ unresolved: c + '()' }];
    }
    if (expr.kind === ts.SyntaxKind.NullKeyword || expr.kind === ts.SyntaxKind.FalseKeyword) return [];
    return [{ unresolved: textOf(expr).slice(0, 40) }];
  }
  function propsOf(objs) {
    const m = new Map();
    const spreads = [];
    for (const o of objs) {
      if (!o.obj) continue;
      for (const p of o.obj.properties) {
        if (ts.isPropertyAssignment(p)) {
          const k = propName(p.name);
          if (k) m.set(k, unwrap(p.initializer));
        } else if (ts.isSpreadAssignment(p)) spreads.push(textOf(p.expression));
        else if (ts.isShorthandPropertyAssignment(p)) m.set(p.name.text, p.name);
      }
    }
    return { m, spreads };
  }
  function numLit(n) {
    n = unwrap(n);
    if (!n) return null;
    if (ts.isNumericLiteral(n)) return +n.text;
    if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(n.operand)) return -n.operand.text;
    return null;
  }
  function strLit(n) {
    n = unwrap(n);
    if (n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n))) return n.text;
    return null;
  }

  // ── scope ──
  function fnName(f) {
    if (ts.isFunctionDeclaration(f)) return f.name ? f.name.text : 'default';
    if (ts.isMethodDeclaration(f) || ts.isConstructorDeclaration(f) || ts.isGetAccessor(f) || ts.isSetAccessor(f)) {
      const cls = f.parent && (ts.isClassDeclaration(f.parent) || ts.isClassExpression(f.parent)) ? (f.parent.name ? f.parent.name.text : 'anon') : null;
      return cls ? `class:${cls}` : propName(f.name) || 'method';
    }
    let p = f.parent;
    while (p && (ts.isCallExpression(p) || ts.isParenthesizedExpression(p) || ts.isAsExpression(p))) p = p.parent;
    if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;
    if (p && ts.isExportAssignment(p)) return 'default';
    if (p && ts.isPropertyAssignment(p)) return propName(p.name) || 'prop';
    return 'anon';
  }
  function scopeOf(n) {
    let inSheet = null;
    let inThemed = false;
    let outer = null;
    for (let p = n.parent; p; p = p.parent) {
      if (ts.isCallExpression(p)) {
        if (isStyleSheetCreate(p) && !inSheet) inSheet = { moduleLevel: isModuleLevel(p), call: p };
        if (isThemedFactory(p)) inThemed = true;
      }
      if (FUNC_KINDS.has(p.kind)) outer = p;
    }
    let sheetVar = null;
    if (inSheet && inSheet.call.parent && ts.isVariableDeclaration(inSheet.call.parent)) sheetVar = inSheet.call.parent.name.getText(sf);
    if (inSheet) return { scope: inSheet.moduleLevel ? 'stylesheet-module' : 'stylesheet-local', sheetVar, fn: outer ? fnName(outer) : '' };
    if (inThemed) return { scope: 'themed', fn: '' };
    if (!outer) return { scope: 'module', fn: '' };
    const name = fnName(outer);
    if (name.startsWith('class:')) return { scope: 'class', fn: name };
    if (/^[A-Z]/.test(name) || /^use[A-Z0-9]/.test(name)) return { scope: /^use/.test(name) ? 'hook' : 'component', fn: name };
    return { scope: 'helper', fn: name };
  }

  function tagOf(el) {
    if (el && (ts.isJsxOpeningElement(el) || ts.isJsxSelfClosingElement(el))) return el.tagName.getText(sf);
    return '?';
  }
  // ── the consumer of a value expression: which key, prop or variable receives it ──
  function consumerOf(node, depth = 0) {
    let cur = node;
    const via = [];
    for (let guard = 0; guard < 40; guard++) {
      const p = cur.parent;
      if (!p) return { kind: 'root', via };
      if (ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || ts.isNonNullExpression(p) || ts.isSatisfiesExpression(p)) {
        cur = p;
        continue;
      }
      if (ts.isConditionalExpression(p)) {
        if (p.condition === cur) return { kind: 'condition', via };
        via.push('?:');
        cur = p;
        continue;
      }
      if (ts.isBinaryExpression(p)) {
        const op = p.operatorToken.kind;
        if ([ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(op)) {
          via.push(p.operatorToken.getText(sf));
          cur = p;
          continue;
        }
        if (op === ts.SyntaxKind.PlusToken) {
          via.push('concat');
          cur = p;
          continue;
        }
        if (op === ts.SyntaxKind.EqualsToken && p.right === cur) return { kind: 'assign', name: p.left.getText(sf), via };
        if ([ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(op)) return { kind: 'compare', via };
        return { kind: 'binary', via };
      }
      if (ts.isTemplateSpan(p)) {
        via.push('template');
        cur = p.parent;
        continue;
      }
      if (ts.isTaggedTemplateExpression(p)) {
        via.push('tagged');
        cur = p;
        continue;
      }
      if (ts.isCallExpression(p) && p.arguments.includes(cur)) {
        via.push('call:' + calleeText(p).slice(0, 40));
        cur = p;
        continue;
      }
      if (ts.isArrayLiteralExpression(p)) {
        via.push('[]');
        cur = p;
        continue;
      }
      if (ts.isSpreadElement(p)) {
        cur = p;
        continue;
      }
      if (ts.isPropertyAssignment(p) && p.initializer === cur) {
        const keyPath = [propName(p.name) || '?'];
        const obj = p.parent;
        let root = null;
        let q = obj;
        for (let g2 = 0; g2 < 30 && q; g2++) {
          const qp = q.parent;
          if (!qp) {
            root = 'root';
            break;
          }
          if (ts.isSpreadAssignment(qp)) {
            q = qp.parent;
            continue;
          }
          if (ts.isParenthesizedExpression(qp) || ts.isAsExpression(qp) || ts.isArrayLiteralExpression(qp) || ts.isConditionalExpression(qp) || ts.isSpreadElement(qp) || ts.isSatisfiesExpression(qp) || ts.isBinaryExpression(qp)) {
            q = qp;
            continue;
          }
          if (ts.isPropertyAssignment(qp)) {
            keyPath.unshift(propName(qp.name) || '?');
            q = qp.parent;
            continue;
          }
          if (ts.isJsxExpression(qp)) {
            const a = qp.parent;
            root = a && ts.isJsxAttribute(a) ? `jsx:${tagOf(a.parent.parent)}.${a.name.getText(sf)}` : 'jsx-child';
            break;
          }
          if (ts.isCallExpression(qp)) {
            root = `call:${calleeText(qp).slice(0, 40)}`;
            break;
          }
          if (ts.isVariableDeclaration(qp)) {
            root = `var:${qp.name.getText(sf)}`;
            break;
          }
          if (ts.isReturnStatement(qp) || ts.isArrowFunction(qp)) {
            root = 'return';
            break;
          }
          if (ts.isPropertyDeclaration(qp)) {
            root = `field:${propName(qp.name)}`;
            break;
          }
          if (ts.isExportAssignment(qp)) {
            root = 'export';
            break;
          }
          if (ts.isBindingElement(qp) || ts.isParameter(qp)) {
            root = 'default-param';
            break;
          }
          root = ts.SyntaxKind[qp.kind];
          break;
        }
        return { kind: 'prop', key: keyPath[keyPath.length - 1], keyPath, root, obj, via };
      }
      if (ts.isShorthandPropertyAssignment(p)) return { kind: 'prop', key: p.name.text, keyPath: [p.name.text], root: '?', via };
      if (ts.isJsxExpression(p)) {
        const a = p.parent;
        if (a && ts.isJsxAttribute(a)) return { kind: 'jsx', attr: a.name.getText(sf), tag: tagOf(a.parent.parent), via };
        return { kind: 'jsx-child', via };
      }
      if (ts.isJsxAttribute(p)) return { kind: 'jsx', attr: p.name.getText(sf), tag: tagOf(p.parent.parent), via };
      if (ts.isVariableDeclaration(p) && p.initializer === cur) {
        const name = p.name.getText(sf);
        const c = { kind: 'var', name, via };
        if (depth === 0 && ts.isIdentifier(p.name)) c.uses = usesOf(p, name).map((u) => consumerOf(u, 1));
        return c;
      }
      if (ts.isReturnStatement(p) || (ts.isArrowFunction(p) && p.body === cur)) {
        let f = p;
        while (f && !FUNC_KINDS.has(f.kind)) f = f.parent;
        return { kind: 'return', fn: f ? fnName(f) : '', via };
      }
      if (ts.isParameter(p) || ts.isBindingElement(p)) return { kind: 'default-param', name: p.name.getText(sf), via };
      if (ts.isPropertyDeclaration(p)) return { kind: 'field', name: propName(p.name), via };
      if (ts.isCaseClause(p) || ts.isSwitchStatement(p)) return { kind: 'case', via };
      if (ts.isElementAccessExpression(p)) return { kind: 'index', via };
      if (ts.isPropertyAccessExpression(p)) return { kind: 'member', via };
      if (ts.isExpressionStatement(p)) return { kind: 'statement', via };
      return { kind: ts.SyntaxKind[p.kind], via };
    }
    return { kind: 'deep', via };
  }
  function usesOf(decl, name) {
    // references of a const within its enclosing block or file
    let scopeNode = decl;
    while (scopeNode && !(ts.isBlock(scopeNode) || ts.isSourceFile(scopeNode))) scopeNode = scopeNode.parent;
    const out = [];
    (function f(n) {
      if (ts.isIdentifier(n) && n.text === name && n !== decl.name && !(ts.isPropertyAccessExpression(n.parent) && n.parent.name === n) && !(ts.isPropertyAssignment(n.parent) && n.parent.name === n)) out.push(n);
      ts.forEachChild(n, f);
    })(scopeNode || sf);
    return out.slice(0, 6);
  }
  /** What a color value draws: fg, bg, stroke, line (a thin View's fill), placeholder, shadow, gradient, svgFill, mixed or unknown. */
  function groupOf(c) {
    if (!c) return 'unknown';
    if (c.kind === 'var' && c.uses && c.uses.length) {
      const gs = [...new Set(c.uses.map(groupOf))].filter((g) => g !== 'unknown');
      return gs.length === 1 ? gs[0] : gs.length ? 'mixed' : 'unknown';
    }
    const k = c.kind === 'prop' ? c.key : c.kind === 'jsx' ? c.attr : c.kind === 'default-param' ? c.name : null;
    if (!k) return 'unknown';
    if (c.kind === 'prop' && c.keyPath && c.keyPath.includes('trackColor')) return 'bg';
    if (/^(icon|text|fg|ink|softInk|tint|label|title|stopColor|activeColor|accent|foreground|check|error|info|iconTint|textTint)$/.test(k)) return 'fg';
    if (/^(bg|tintBg|surface|track|chipBg|badgeBg)$/.test(k)) return 'bg';
    if (c.kind === 'prop' && /^(colors|locations)$/.test(k)) return 'gradient';
    if (/placeholderTextColor/.test(k)) return 'placeholder';
    if (/^shadowColor$/.test(k)) return 'shadow';
    if (/border\w*Color|outlineColor|^stroke$|strokeColor|separatorColor|dividerColor|textDecorationColor/i.test(k)) return 'stroke';
    if (/^(backgroundColor|underlayColor|backdropColor|bg|background|fillColor|surfaceColor|containerColor|headerBackgroundColor|statusBarBackgroundColor|navigationBarColor|trackColor|ios_backgroundColor)$/i.test(k)) {
      if (c.kind === 'prop' && c.obj) {
        const { m } = propsOf([{ obj: c.obj }]);
        const thin = (x) => x && (numLit(x) !== null ? numLit(x) <= 1.5 : /hairlineWidth/.test(x.getText(sf)));
        if (thin(m.get('height')) || thin(m.get('width'))) return 'line';
      }
      return 'bg';
    }
    if (/^fill$/.test(k)) return 'svgFill';
    if (/^(color|tintColor|iconColor|headerTintColor|tabBarActiveTintColor|tabBarInactiveTintColor|selectionColor|cursorColor|controlsColor|thumbColor|activeColor|inactiveColor|textColor|labelColor|titleColor|caretColor|indicatorColor|progressBackgroundColor|activeTintColor|inactiveTintColor|captionColor|captionHaloColor|subCaptionColor|haloColor|accentColor|highlightColor)$/i.test(k)) return 'fg';
    return 'unknown';
  }
  function rawOf(c) {
    if (!c) return {};
    if (c.kind === 'prop') return { root: c.root, keyPath: c.keyPath };
    if (c.kind === 'jsx') return { tag: c.tag, attr: c.attr };
    if (c.kind === 'var') return { kind: 'var', name: c.name, uses: (c.uses || []).map(rawOf) };
    return { kind: c.kind, name: c.name };
  }
  function styleKeyOf(c) {
    if (c && c.kind === 'prop' && c.keyPath) return c.keyPath.length > 1 ? c.keyPath[c.keyPath.length - 2] : c.root || '';
    if (c && c.kind === 'var') return c.name;
    return '';
  }
  function pressedCtx(node) {
    for (let p = node.parent, i = 0; p && i < 8; p = p.parent, i++) {
      if (ts.isPropertyAssignment(p) && /pressed|Pressed|active|Active|selected|Selected/.test(propName(p.name) || '')) return true;
      if (ts.isConditionalExpression(p) && /pressed/i.test(p.condition.getText(sf))) return true;
      if (ts.isBinaryExpression(p) && /pressed/i.test(p.left.getText(sf))) return true;
    }
    return false;
  }
  const sheetCtx = (c) => SHEET_RE.test(file) || !!(c && c.keyPath && c.keyPath.some((k) => SHEET_RE.test(k)));
  function consumerText(c) {
    if (!c) return '';
    let s;
    if (c.kind === 'prop') s = `${c.root || '?'} › ${c.keyPath.join('.')}`;
    else if (c.kind === 'jsx') s = `<${c.tag}> ${c.attr}`;
    else if (c.kind === 'var') s = `var ${c.name}` + (c.uses && c.uses.length ? ' → ' + [...new Set(c.uses.map(consumerText))].slice(0, 3).join(' | ') : '');
    else if (c.kind === 'return') s = `return(${c.fn})`;
    else s = c.kind + (c.name ? ':' + c.name : '');
    if (c.via && c.via.length) s += ` [via ${[...new Set(c.via)].join(',')}]`;
    return s;
  }
  /** The color fields every color record carries: what it draws and where it sits. */
  function colorFields(n, c) {
    let group = groupOf(c);
    if (group === 'bg' && pressedCtx(n)) group = 'bgPressed';
    const sc = scopeOf(n);
    return { group, consumer: consumerText(c), scope: sc.scope, fn: sc.fn, sheetVar: sc.sheetVar || '', styleKey: styleKeyOf(c), sheet: sheetCtx(c), consumerRaw: rawOf(c) };
  }

  const adaptiveVars = new Set();
  const styleUse = new Map(); // 'styles.key' → Set(tag)

  function visit(n) {
    // ─ SdsColors.X, the token APIs, useAdaptive() reads ─
    if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression)) {
      const local = n.expression.text;
      const name = n.name.text;
      const exp = ownExport(local);
      if (exp === 'SdsColors') {
        R.sdsColors.push({ ...base(n), local, name, ...colorFields(n, consumerOf(n)), disabled: isDisabled(lineOf(n), 'sds/no-sds-colors') });
      } else if (exp === 'colorSeeds' || exp === 'SdsPalette') {
        const c = consumerOf(n);
        R.otherColorApi.push({ ...base(n), api: exp, name, consumer: consumerText(c), group: groupOf(c), scope: scopeOf(n).scope });
      } else if (adaptiveVars.has(local)) {
        const c = consumerOf(n);
        R.adaptive.push({ ...base(n), kind: 'read', name, consumer: consumerText(c), group: groupOf(c) });
      } else if (exp && TOKEN_APIS.has(exp)) {
        const c = consumerOf(n);
        R.tokenUse.push({ ...base(n), api: exp, name, key: c.kind === 'prop' ? c.key : c.kind === 'jsx' ? c.attr : c.kind });
      }
    }
    // semantic reads: x.fg.y / x.bg.y / x.stroke.y
    if (ts.isPropertyAccessExpression(n) && ts.isPropertyAccessExpression(n.expression) && ['fg', 'bg', 'stroke'].includes(n.expression.name.text)) {
      const steps = context.tokens.semanticColorSteps[n.expression.name.text];
      if (steps && steps[n.name.text] !== undefined) {
        const c = consumerOf(n);
        R.semanticUse.push({ ...base(n), token: `${n.expression.name.text}.${n.name.text}`, consumer: consumerText(c), scope: scopeOf(n).scope, consumerRaw: rawOf(c) });
      }
    }
    // useAdaptive()
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'useAdaptive') {
      if (ts.isVariableDeclaration(n.parent) && ts.isIdentifier(n.parent.name)) adaptiveVars.add(n.parent.name.text);
      R.adaptive.push({ ...base(n), kind: 'call', name: '', consumer: '', group: '' });
    }
    // ─ string literals: colors and scheme-fixed values ─
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      const parent = n.parent;
      const isImport = ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isExternalModuleReference(parent) || (ts.isCallExpression(parent) && parent.expression.getText(sf) === 'require');
      if (!isImport && !ts.isLiteralTypeNode(parent) && !(ts.isPropertyAssignment(parent) && parent.name === n)) {
        const c0 = consumerOf(n);
        const g0 = groupOf(c0);
        const colorish = g0 !== 'unknown' || (c0.kind === 'prop' && /color|Color/.test(c0.key)) || (c0.kind === 'jsx' && /color|Color|fill|stroke/.test(c0.attr));
        const col = parseColor(n.text, colorish);
        if (col) {
          const sdsName = colors.sdsNameForColor(col);
          const nearest = sdsName ? null : colors.nearestPalette(col);
          R.colorLit.push({
            ...base(n),
            value: n.text,
            hex: hex6(col),
            alpha: col.a,
            sdsName: sdsName || '',
            nearest: nearest ? `${nearest.name} ${nearest.hex} dE${nearest.d.toFixed(1)}` : '',
            nearestD: nearest ? nearest.d : null,
            ...colorFields(n, c0),
            disabled: isDisabled(lineOf(n), 'sds/no-color-literal'),
          });
        } else {
          const hexes = n.text.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\)/g) || [];
          if (hexes.length && n.text.length > 12) R.colorEmbedded.push({ ...base(n), count: hexes.length, values: [...new Set(hexes)].slice(0, 8).join(' ') });
          const cK = c0.kind === 'prop' ? c0.key : c0.kind === 'jsx' ? c0.attr : '';
          if (
            /^(light|dark|auto|light-content|dark-content|systemMaterialLight|systemChromeMaterialLight|systemUltraThinMaterialLight|systemThinMaterialLight|regular|prominent|extraLight|systemMaterial|clear)$/.test(n.text) &&
            /style|Style|barStyle|tint|blurEffect|keyboardAppearance|indicatorStyle|colorScheme|userInterfaceStyle|appearance|theme|glassEffectStyle|statusBarStyle|blurType|effect/i.test(cK)
          ) {
            R.schemeLiteral.push({ ...base(n), value: n.text, consumer: consumerText(c0) });
          }
        }
      }
    }
    // template literals with embedded colors (CSS and JS strings)
    if (ts.isTemplateExpression(n)) {
      const hexes = n.getText(sf).match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\)/g) || [];
      if (hexes.length) R.colorEmbedded.push({ ...base(n), count: hexes.length, values: [...new Set(hexes)].slice(0, 8).join(' ') });
    }
    // ─ property assignments: typography, spacing, radius, shadow, duration, opacity ─
    if (ts.isPropertyAssignment(n)) {
      const k = propName(n.name);
      if (k) {
        const v = unwrap(n.initializer);
        const nl = numLit(v);
        const sl = strLit(v);
        const objKey = () => {
          const pa = n.parent && n.parent.parent;
          if (pa && ts.isPropertyAssignment(pa)) return propName(pa.name);
          if (pa && ts.isVariableDeclaration(pa)) return pa.name.getText(sf);
          if (pa && ts.isJsxExpression(pa)) return 'inline';
          return '';
        };
        // A Txt prop table ({ typography: 't4', fontWeight: 'bold' }) is not a style.
        const isPropConfig = ts.isObjectLiteralExpression(n.parent) && n.parent.properties.some((q) => ts.isPropertyAssignment(q) && propName(q.name) === 'typography');
        if (TYPO_KEYS.has(k) && (nl !== null || (sl !== null && !/^t\d+$/.test(sl))) && !isPropConfig) {
          const sc = scopeOf(n);
          const rule = k === 'fontWeight' ? 'sds/no-font-weight-literal' : k === 'fontFamily' ? 'sds/no-font-family-literal' : 'sds/no-type-size-literal';
          R.typoLit.push({ ...base(n), prop: k, value: nl !== null ? nl : sl, objKey: objKey(), scope: sc.scope, sheetVar: sc.sheetVar || '', objPos: n.parent.pos, disabled: isDisabled(lineOf(n), rule) });
        }
        if (SPACING_KEYS.test(k) || RADIUS_KEYS.test(k)) {
          const kindK = SPACING_KEYS.test(k) ? 'spacing' : 'radius';
          let valueKind;
          let value = null;
          if (nl !== null) {
            valueKind = 'literal';
            value = nl;
          } else if (/^Sds(Spacing|Radius)\.\w+$/.test(v.getText(sf))) {
            valueKind = 'token';
            value = v.getText(sf);
          } else if (/Sds(Spacing|Radius)\./.test(v.getText(sf))) {
            valueKind = 'token-expr';
            value = v.getText(sf).replace(/\s+/g, ' ').slice(0, 60);
          } else if (sl !== null) {
            valueKind = 'string';
            value = sl;
          } else {
            valueKind = 'expr';
            value = v.getText(sf).replace(/\s+/g, ' ').slice(0, 60);
          }
          // pill: radius is half of a literal height (or of a square's width) in the same object
          let pill = '';
          if (kindK === 'radius' && valueKind === 'literal' && ts.isObjectLiteralExpression(n.parent)) {
            const { m } = propsOf([{ obj: n.parent }]);
            const h = m.get('height') && numLit(m.get('height'));
            const w = m.get('width') && numLit(m.get('width'));
            if (Math.abs(value) >= 999) pill = 'pill';
            else if ((h && Math.abs(h / 2 - value) < 0.01) || (w && Math.abs(w / 2 - value) < 0.01 && (!h || h === w))) pill = h && w && h === w ? 'circle' : 'pill';
          }
          const sc = scopeOf(n);
          const rule = kindK === 'spacing' ? 'sds/no-spacing-literal' : 'sds/no-radius-literal';
          R.spacing.push({ ...base(n), kind: kindK, prop: k, valueKind, value, pill, objKey: objKey(), scope: sc.scope, sheetVar: sc.sheetVar || '', valueStart: v.getStart(sf), valueEnd: v.getEnd(), disabled: isDisabled(lineOf(n), rule) });
        }
        if (SHADOW_KEYS.has(k)) {
          const lit = nl !== null || sl !== null || ts.isObjectLiteralExpression(v);
          R.shadow.push({ ...base(n), prop: k, value: v.getText(sf).replace(/\s+/g, ' ').slice(0, 60), literal: lit, objPos: n.parent.pos, objKey: objKey() });
        }
        if (k === 'duration' && nl !== null) R.durations.push({ ...base(n), value: nl });
        if (k === 'opacity') {
          let dis = null;
          if (ts.isConditionalExpression(v) && /disabled|isDisabled|enabled/i.test(v.condition.getText(sf))) {
            const cond = v.condition.getText(sf);
            dis = /!|enabled/.test(cond) && !/disabled/i.test(cond) ? v.whenFalse.getText(sf) : v.whenTrue.getText(sf);
          } else if (nl !== null) {
            const par = n.parent && n.parent.parent;
            const andCond = par && ts.isBinaryExpression(par) && /disabled/i.test(par.left.getText(sf));
            if (/disabled/i.test(objKey() || '') || andCond) dis = String(nl);
          }
          if (dis !== null) R.disabledOpacity.push({ ...base(n), value: dis });
        }
      }
    }
    // ─ JSX ─
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const tag = n.tagName.getText(sf);
      const [rootId, member] = tag.split('.');
      const imp = imports.get(rootId);
      const attrs = new Map();
      for (const a of n.attributes.properties) if (ts.isJsxAttribute(a)) attrs.set(a.name.getText(sf), a);
      const styleAttrs = [...attrs.entries()].filter(([k]) => k === 'style' || /Style$/.test(k));
      for (const [, a] of styleAttrs) {
        if (!a.initializer || !ts.isJsxExpression(a.initializer) || !a.initializer.expression) continue;
        for (const r of resolveStyle(a.initializer.expression)) {
          if (r.ref && r.ref !== 'inline') {
            if (!styleUse.has(r.ref)) styleUse.set(r.ref, new Set());
            styleUse.get(r.ref).add(tag);
          }
        }
      }
      // A1: React Native's Text, by binding: `Text`/`Text as X`, `RN.Text` from a namespace import, Animated.Text
      const isRNText = imp && imp.mod === 'react-native' && ((!member && imp.imported === 'Text') || (member === 'Text' && imp.imported === '*'));
      const isAnimText =
        member === 'Text' && imp && ((imp.mod === 'react-native' && imp.imported === 'Animated') || (imp.mod === 'react-native-reanimated' && (imp.imported === 'default' || imp.imported === '*')));
      if (isRNText || isAnimText) {
        const sa = attrs.get('style');
        let objs = [];
        if (sa && sa.initializer && ts.isJsxExpression(sa.initializer) && sa.initializer.expression) objs = resolveStyle(sa.initializer.expression);
        const { m, spreads } = propsOf(objs);
        const unresolved = objs.filter((o) => o.unresolved).map((o) => o.unresolved);
        const fsz = m.get('fontSize') ? numLit(m.get('fontSize')) : null;
        const lh = m.get('lineHeight') ? numLit(m.get('lineHeight')) : null;
        const fwRaw = m.get('fontWeight') ? (strLit(m.get('fontWeight')) ?? numLit(m.get('fontWeight'))) : null;
        let parentTag = '';
        for (let q = (ts.isJsxOpeningElement(n) ? n.parent : n).parent; q; q = q.parent) {
          if (ts.isJsxElement(q)) {
            parentTag = q.openingElement.tagName.getText(sf);
            break;
          }
          if (FUNC_KINDS.has(q.kind)) break;
        }
        R.rnText.push({
          ...base(n),
          tag,
          parentTag,
          nested: /^(Txt|Text|Animated\.Text)$/.test(parentTag),
          element: isAnimText ? 'Animated.Text' : 'Text',
          module: imp.mod,
          styleRefs: objs.map((o) => o.ref || `?${o.unresolved}`).join(' '),
          fontSize: fsz,
          fontSizeExpr: m.get('fontSize') && fsz === null ? m.get('fontSize').getText(sf) : '',
          lineHeight: lh,
          lineHeightExpr: m.get('lineHeight') && lh === null ? m.get('lineHeight').getText(sf) : '',
          fontWeight: fwRaw,
          fontFamily: m.get('fontFamily') ? m.get('fontFamily').getText(sf) : null,
          color: m.get('color') ? m.get('color').getText(sf).replace(/\s+/g, ' ') : null,
          spreads: spreads.join(' '),
          unresolved: unresolved.join(' '),
          allowFontScaling: attrs.has('allowFontScaling') ? attrs.get('allowFontScaling').getText(sf) : '',
          disabled: isDisabled(lineOf(n), 'sds/no-rn-text'),
        });
      }
      // A6: primitives
      if (imp && imp.mod === 'react-native' && PRIMITIVES.includes(imp.imported)) R.primitives.push({ ...base(n), primitive: imp.imported, module: 'react-native', attrs: [...attrs.keys()].join(' ') });
      if (imp && imp.mod.startsWith('@expo/vector-icons')) R.primitives.push({ ...base(n), primitive: tag, module: imp.mod, attrs: [...attrs.keys()].join(' ') });
      if (imp && imp.mod === 'expo-status-bar') R.primitives.push({ ...base(n), primitive: 'StatusBar(expo)', module: imp.mod, attrs: [...attrs.values()].map((a) => a.getText(sf)).join(' ') });
      // Pressables, by binding (what sds/no-rn-pressable bans)
      if (imp && !member && PRESSABLES[imp.mod]?.includes(imp.imported)) {
        const sa = attrs.get('style');
        let fb = 'none';
        if (sa && sa.initializer && /pressed/.test(sa.getText(sf))) fb = 'style-fn';
        if (attrs.has('android_ripple')) fb += '+ripple';
        R.pressables.push({ ...base(n), module: imp.mod, primitive: imp.imported, feedback: fb, disabled: isDisabled(lineOf(n), 'sds/no-rn-pressable') });
      }
      // A5: press feedback built in a style function
      for (const [, a] of styleAttrs) {
        if (!a.initializer || !ts.isJsxExpression(a.initializer) || !a.initializer.expression) continue;
        const ex = a.initializer.expression;
        if (!/\bpressed\b|isPressed/.test(ex.getText(sf))) continue;
        collectPress(ex, tag);
      }
      if (attrs.has('activeOpacity')) R.press.push({ ...base(n), tag, kind: 'activeOpacity', prop: 'opacity', value: attrs.get('activeOpacity').initializer.getText(sf).replace(/[{}]/g, ''), mechanism: 'TouchableOpacity' });
      else if (imp && imp.imported === 'TouchableOpacity') R.press.push({ ...base(n), tag, kind: 'activeOpacity(default)', prop: 'opacity', value: '0.2', mechanism: 'TouchableOpacity' });
      if (attrs.has('underlayColor')) R.press.push({ ...base(n), tag, kind: 'underlayColor', prop: 'backgroundColor', value: attrs.get('underlayColor').initializer.getText(sf), mechanism: 'TouchableHighlight' });
      if (attrs.has('android_ripple')) R.press.push({ ...base(n), tag, kind: 'android_ripple', prop: 'ripple', value: attrs.get('android_ripple').initializer.getText(sf).replace(/\s+/g, ' ').slice(0, 60), mechanism: 'ripple' });
      // B4: styles that fight an SDS component
      if (imp && isSdsMod(imp.mod)) {
        for (const [k, a] of styleAttrs) {
          if (!a.initializer || !ts.isJsxExpression(a.initializer) || !a.initializer.expression) continue;
          const objs = resolveStyle(a.initializer.expression);
          const { m, spreads } = propsOf(objs);
          const keys = [...m.keys()];
          if (!keys.length && !spreads.length) continue;
          R.sdsOverride.push({
            ...base(n),
            component: tag,
            attr: k,
            keys: keys.join(' '),
            spreads: spreads.join(' '),
            refs: objs.map((o) => o.ref || `?${o.unresolved}`).join(' '),
            values: keys.map((x) => `${x}=${m.get(x).getText(sf).replace(/\s+/g, ' ').slice(0, 30)}`).join('; '),
          });
        }
      }
      // B6: inline style
      for (const [k, a] of styleAttrs) {
        if (!a.initializer || !ts.isJsxExpression(a.initializer) || !a.initializer.expression) continue;
        const objs = resolveStyle(a.initializer.expression).filter((o) => o.ref === 'inline');
        if (!objs.length) continue;
        const { m } = propsOf(objs);
        const keys = [...m.keys()];
        const literalKeys = keys.filter((x) => {
          const v = m.get(x);
          return numLit(v) !== null || strLit(v) !== null || /^SdsColors\./.test(v.getText(sf));
        });
        R.inlineStyle.push({ ...base(n), tag, attr: k, keys: keys.join(' '), literalKeys: literalKeys.join(' '), dynamicOnly: literalKeys.length === 0 });
      }
    }
    ts.forEachChild(n, visit);
  }

  function collectPress(ex, tag) {
    (function f(n) {
      if (ts.isConditionalExpression(n) && /pressed/i.test(n.condition.getText(sf))) {
        const p = n.parent;
        if (ts.isPropertyAssignment(p)) {
          const k = propName(p.name);
          R.press.push({ ...base(n), tag, kind: k === 'opacity' ? 'opacity' : k === 'transform' ? 'scale' : k, prop: k, value: n.whenTrue.getText(sf).replace(/\s+/g, ' ').slice(0, 50), rest: n.whenFalse.getText(sf).slice(0, 30), mechanism: 'style-fn' });
        } else {
          for (const r of resolveStyle(n.whenTrue)) addResolved(r, n, tag);
        }
      }
      const innerOfAnd = n.parent && ts.isBinaryExpression(n.parent) && n.parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && n.parent.left === n;
      if (!innerOfAnd && ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && /pressed/i.test(n.left.getText(sf))) {
        for (const r of resolveStyle(n.right)) addResolved(r, n, tag);
      }
      if (ts.isPropertyAssignment(n) && propName(n.name) === 'scale' && /pressed/i.test(n.initializer.getText(sf))) {
        const v = unwrap(n.initializer);
        R.press.push({ ...base(n), tag, kind: 'scale', prop: 'scale', value: ts.isConditionalExpression(v) ? v.whenTrue.getText(sf) : v.getText(sf), mechanism: 'style-fn' });
      }
      ts.forEachChild(n, f);
    })(ex);
  }
  function addResolved(r, n, tag) {
    if (!r.obj) {
      R.press.push({ ...base(n), tag, kind: 'unresolved', prop: '', value: r.unresolved || '', mechanism: 'style-fn' });
      return;
    }
    for (const p of r.obj.properties) {
      if (!ts.isPropertyAssignment(p)) continue;
      const k = propName(p.name);
      let kind = k;
      if (k === 'transform') kind = 'scale';
      else if (/backgroundColor/.test(k)) kind = 'backgroundColor';
      R.press.push({ ...base(n), tag, kind, prop: k, value: p.initializer.getText(sf).replace(/\s+/g, ' ').slice(0, 60), ref: r.ref, mechanism: 'style-fn' });
    }
  }

  visit(sf);

  // A file that calls usePressFeedback may keep RN's Pressable as the trigger (SDS.md).
  const callsPressFeedback = /\busePressFeedback\s*\(/.test(text);
  for (const p of R.pressables) p.feedbackHook = callsPressFeedback && p.primitive === 'Pressable';

  // ── module StyleSheets (B3) ──
  for (const [v, s] of sheets) {
    if (s.themed) continue;
    const refs = [];
    (function f(n) {
      if (ts.isIdentifier(n) && n.text === v && ts.isPropertyAccessExpression(n.parent) && n.parent.expression === n) refs.push(n);
      ts.forEachChild(n, f);
    })(sf);
    const refScopes = refs.map((r) => scopeOf(r));
    const scopeSet = [...new Set(refScopes.map((s2) => `${s2.scope}:${s2.fn}`))];
    R.sheets.push({
      file,
      line: s.line,
      area,
      sheetVar: v,
      moduleLevel: s.moduleLevel,
      exported: !!s.exported,
      entries: s.entries.size,
      refScopes: scopeSet.join(' '),
      allInComponents: refScopes.every((s2) => ['component', 'hook', 'stylesheet-module'].includes(s2.scope)),
      styleUse: [...s.entries.keys()].map((k) => `${k}:${[...(styleUse.get(`${v}.${k}`) || [])].join('/')}`).join(' '),
    });
  }
  // the elements that use each typography and spacing object
  for (const t of R.typoLit) if (t.sheetVar && t.objKey) t.hosts = [...(styleUse.get(`${t.sheetVar}.${t.objKey}`) || [])].join('/');
  for (const t of R.spacing) if (t.sheetVar && t.objKey) t.hosts = [...(styleUse.get(`${t.sheetVar}.${t.objKey}`) || [])].join('/');
  return R;
}

/** Scan `files` (repository-relative, default every scanned file) and merge the records. */
export function scanRepo(files = scanFiles(), { root = repoRoot, context = scanContext() } = {}) {
  const R = Object.fromEntries(CATEGORIES.map((c) => [c, []]));
  for (const file of files) {
    const one = scanSource(file, readFileSync(resolve(root, file), 'utf8'), context);
    for (const c of CATEGORIES) R[c].push(...one[c]);
  }
  R.meta = { scanned: files.length };
  return R;
}

// ── the comparison with the lint record ──

/**
 * Per-file counts of the scanner's records under the lint rules they
 * correspond to, with exceptions (line disables, registry entries) dropped.
 * `{ [rule]: { [file]: count } }`.
 */
export function countsByRule(R, registry = []) {
  const excepted = (rule, file) => registry.some((e) => e.rules.includes(rule) && e.files.includes(file));
  const out = {};
  const add = (rule, rec) => {
    if (rec.disabled || excepted(rule, rec.file)) return;
    out[rule] ??= {};
    out[rule][rec.file] = (out[rule][rec.file] ?? 0) + 1;
  };
  for (const r of R.sdsColors) add('sds/no-sds-colors', r);
  for (const r of R.spacing) if (r.valueKind === 'literal' && r.value !== 0) add(r.kind === 'spacing' ? 'sds/no-spacing-literal' : 'sds/no-radius-literal', r);
  for (const r of R.colorLit) add('sds/no-color-literal', r);
  for (const r of R.typoLit) {
    if (typeof r.value !== 'number' && r.prop !== 'fontWeight') continue;
    if (r.prop === 'fontWeight') {
      if (/^(?:[1-9]00|bold|normal)$/.test(String(r.value))) add('sds/no-font-weight-literal', r);
    } else if (r.prop !== 'fontFamily') add('sds/no-type-size-literal', r);
  }
  for (const r of R.rnText) add('sds/no-rn-text', r);
  for (const r of R.pressables) if (!r.feedbackHook) add('sds/no-rn-pressable', r);
  return out;
}

/** Rows `{ rule, scan, record, files: [{ file, scan, record }] }` for the rules the scanner covers. */
export function compareWithRecord(counts, record, { skipFiles = [] } = {}) {
  const rows = [];
  for (const rule of Object.keys(counts).sort()) {
    const byFile = new Map();
    for (const [file, n] of Object.entries(counts[rule])) byFile.set(file, { file, scan: n, record: 0 });
    for (const [file, rules] of Object.entries(record)) {
      if (!rules[rule]) continue;
      const row = byFile.get(file) ?? { file, scan: 0, record: 0 };
      row.record = rules[rule].count;
      byFile.set(file, row);
    }
    const files = [...byFile.values()].filter((f) => !skipFiles.includes(f.file));
    rows.push({
      rule,
      scan: files.reduce((s, f) => s + f.scan, 0),
      record: files.reduce((s, f) => s + f.record, 0),
      files: files.filter((f) => f.scan !== f.record).sort((a, b) => Math.abs(b.scan - b.record) - Math.abs(a.scan - a.record)),
    });
  }
  return rows;
}

function main(argv) {
  const json = argv.includes('--json') ? argv[argv.indexOf('--json') + 1] : null;
  const compare = argv.includes('--compare');
  const paths = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--json');
  const files = paths.length ? paths : scanFiles();
  const R = scanRepo(files);
  if (json) writeFileSync(json, JSON.stringify(R, null, 1));
  if (compare) {
    const require = createRequire(import.meta.url);
    const registry = require(resolve(repoRoot, 'scripts/eslint/sds-exceptions.cjs'));
    const record = JSON.parse(readFileSync(resolve(repoRoot, 'eslint-suppressions.json'), 'utf8'));
    for (const row of compareWithRecord(countsByRule(R, registry), record)) {
      console.log(`${row.rule.padEnd(28)} scan ${String(row.scan).padStart(5)}  record ${String(row.record).padStart(5)}  gap ${row.scan - row.record}`);
      for (const f of row.files) console.log(`    ${f.file}  scan ${f.scan}  record ${f.record}`);
    }
    return;
  }
  console.log(`scanned ${R.meta.scanned} files`);
  for (const c of CATEGORIES) console.log(`${c.padEnd(16)} ${R[c].length}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main(process.argv.slice(2));
