#!/usr/bin/env node
// K2: spacing and radius literals to SdsSpacing and SdsRadius.
//
//   node scripts/codemods/sds/spacing-radius.mjs [--write] [--allow-dirty] [paths]
//
// What it rewrites, in a style object (a StyleSheet or createThemedStyles
// entry, a style or *Style attribute, a variable, key or type named for a
// style, a recipe) and in a JSX attribute the lint rules read (`gap={8}`):
//
// - a non-zero padding, margin or gap on the scale, to its step from
//   migration-map.json (`-SdsSpacing.x1` for a negative one);
// - a horizontal inset of 20 (paddingHorizontal, marginLeft, …) to
//   `SdsSpacing.gutter` when it is a screen-edge inset, which is every one but
//   those in NOT_GUTTER: the same 20, under the name SPACE-02 asks for
//   (docs/decisions/0017);
// - a radius on the scale to its step, and a pill to `SdsRadius.full`: a
//   `borderRadius` of 999 or more, or of half a literal height (or of a square's
//   width) in the same object. React Native shrinks a uniform radius larger
//   than the box to half its shorter side, so both draw the same shape. A
//   per-corner radius is not shrunk that way, so a half-height one keeps its
//   step.
//
// What it leaves, listed in its report: an off-scale value (the H3 batch), a
// literal outside a style object, and every literal in a file a plain-Node
// test imports, where the package import would load React Native.
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

import { runCodemod } from './codemod.mjs';
import { addNamedImports, nodeTestedFiles, parse } from './imports.mjs';

const MAP = JSON.parse(readFileSync(new URL('./migration-map.json', import.meta.url), 'utf8'));
const SPACING_KEY = /^(?:(?:padding|margin)(?:Top|Bottom|Left|Right|Horizontal|Vertical|Start|End|Block|BlockStart|BlockEnd|Inline|InlineStart|InlineEnd)?|gap|rowGap|columnGap)$/;
const RADIUS_KEY = /^border(?:(?:Top|Bottom)(?:Left|Right|Start|End)|(?:Start|End)(?:Start|End)|)Radius$/;
const HORIZONTAL_INSET = /^(?:padding|margin)(?:Horizontal|Left|Right|Start|End|Inline|InlineStart|InlineEnd)$/;
const STYLE_CALL = /^(?:StyleSheet\.(?:create|flatten|compose)|createThemedStyles)$|Recipe$/;
const STYLE_NAME = /style/i;

/** Horizontal 20s that are not a screen-edge inset: padding inside a control or a card. `file#styleKey`. */
export const NOT_GUTTER = new Set([
  'apps/mobile/app/webview.tsx#retryButton', // a button's own padding
  'apps/mobile/src/features/home/components/HeroBanner.tsx#card', // inside the banner card, which has its own margin
]);

const GUTTER = 'SdsSpacing.gutter';

function propName(n) {
  return n && (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n)) ? n.text : null;
}

function numberOf(n) {
  while (n && (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isSatisfiesExpression(n))) n = n.expression;
  if (!n) return null;
  if (ts.isNumericLiteral(n)) return { node: n, value: Number(n.text) };
  if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(n.operand)) return { node: n, value: -Number(n.operand.text) };
  return null;
}

/** Whether a property sits in a style: walks out to the first thing that says so, or to a statement that says not. */
function inStyle(node, sf) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isCallExpression(p) && STYLE_CALL.test(p.expression.getText(sf))) return true;
    if (ts.isJsxAttribute(p)) return /^style$|Style$/.test(p.name.getText(sf));
    if (ts.isPropertyAssignment(p) && STYLE_NAME.test(propName(p.name) ?? '')) return true;
    if (ts.isVariableDeclaration(p)) return STYLE_NAME.test(p.name.getText(sf)) || (!!p.type && STYLE_NAME.test(p.type.getText(sf)));
    if (ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p)) return STYLE_NAME.test(p.name?.getText(sf) ?? '');
    if (ts.isSourceFile(p)) return false;
  }
  return false;
}

/** The key of the style entry a property belongs to (`row` in `row: { padding: 8 }`), or ''. */
function styleKeyOf(prop) {
  const obj = prop.parent;
  const holder = obj && obj.parent;
  if (holder && ts.isPropertyAssignment(holder)) return propName(holder.name) ?? '';
  if (holder && ts.isVariableDeclaration(holder)) return holder.name.getText();
  return '';
}

/** Half of a literal height, or of a square's width, in the same object. */
function isHalfOfSide(prop, size) {
  const sides = {};
  for (const q of prop.parent.properties) {
    if (!ts.isPropertyAssignment(q)) continue;
    const k = propName(q.name);
    if (k === 'height' || k === 'width') sides[k] = numberOf(q.initializer)?.value ?? null;
  }
  const { height: h, width: w } = sides;
  if (h && h === size * 2) return true;
  return !!w && w === size * 2 && (h === undefined || h === w);
}

/**
 * The replacement for one literal, `{ text, api }`, or `{ reason }` to leave it.
 * `prop` is the PropertyAssignment, or null for a JSX attribute.
 */
export function replacementFor({ file, key, value, prop }) {
  const size = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (SPACING_KEY.test(key)) {
    if (size === 20 && value > 0 && HORIZONTAL_INSET.test(key) && !(prop && NOT_GUTTER.has(`${file}#${styleKeyOf(prop)}`))) return { text: GUTTER, api: 'SdsSpacing' };
    const step = MAP.spacing[String(size)];
    if (!step) return { reason: `${key}: ${value} is off the spacing scale` };
    return { text: `${sign}${step.next}`, api: 'SdsSpacing' };
  }
  if (size >= 999) return { text: `${sign}SdsRadius.full`, api: 'SdsRadius' };
  if (prop && key === 'borderRadius' && isHalfOfSide(prop, size)) return { text: 'SdsRadius.full', api: 'SdsRadius' };
  const step = MAP.radius[String(size)];
  if (!step) return { reason: `${key}: ${value} is off the radius scale` };
  return { text: `${sign}${step.next}`, api: 'SdsRadius' };
}

/** The transform runCodemod calls for one file. */
export function transform(file, text) {
  const sf = parse(file, text);
  const edits = [];
  const unresolved = [];
  const apis = new Set();
  const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const nodeTested = nodeTestedFiles().has(file);
  const consider = (key, valueNode, prop, site) => {
    if (!SPACING_KEY.test(key) && !RADIUS_KEY.test(key)) return;
    const num = numberOf(valueNode);
    if (!num || num.value === 0) return;
    const at = line(num.node);
    if (prop && !inStyle(prop, sf)) return unresolved.push({ line: at, reason: `${key}: ${num.value} is not in a style object` });
    if (nodeTested) return unresolved.push({ line: at, reason: `${key}: ${num.value} is in a file a plain-Node test imports` });
    const r = replacementFor({ file, key, value: num.value, prop });
    if (r.reason) return unresolved.push({ line: at, reason: r.reason });
    edits.push({ start: num.node.getStart(sf), end: num.node.getEnd(), text: r.text });
    apis.add(r.api);
  };
  (function visit(n) {
    if (ts.isPropertyAssignment(n) && ts.isObjectLiteralExpression(n.parent)) consider(propName(n.name) ?? '', n.initializer, n, 'prop');
    if (ts.isJsxAttribute(n) && n.initializer && ts.isJsxExpression(n.initializer) && n.initializer.expression) consider(n.name.getText(sf), n.initializer.expression, null, 'jsx');
    ts.forEachChild(n, visit);
  })(sf);
  if (edits.length) {
    const bound = new Set();
    for (const st of sf.statements) {
      if (!ts.isImportDeclaration(st) || !st.importClause) continue;
      const nb = st.importClause.namedBindings;
      if (nb && ts.isNamedImports(nb)) for (const el of nb.elements) if (st.moduleSpecifier.text !== '@skkuverse/shared') bound.add(el.name.text);
    }
    const clash = [...apis].filter((a) => bound.has(a));
    if (clash.length) return { edits: [], unresolved: [{ line: 1, reason: `${clash.join(', ')} is imported from another module here` }] };
    edits.push(...addNamedImports(sf, [...apis], '@skkuverse/shared'));
  }
  return { edits, unresolved };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) runCodemod({ name: 'spacing-radius', transform });
