#!/usr/bin/env node
// K5, CM3: a Txt style's size and weight lifted into Txt's props.
//
//   node scripts/codemods/sds/txt-style-lift.mjs [--write] [--allow-dirty] [paths]
//
// A style entry (in a StyleSheet or a createThemedStyles sheet of the same
// file) moves when only Txt elements read it, each unconditionally, and
// nothing else in their style sets the same keys:
//
// - `fontSize` on the type scale (migration-map.json, exact) becomes the
//   `typography` prop, together with its `lineHeight`, when the line height
//   each Txt drew stays the same: the style's own, or with none, the one of
//   the Txt's `typography` (`t7` by default);
// - a `fontWeight` literal that names a Txt weight exactly becomes the
//   `fontWeight` prop.
//
// What it leaves, listed in its report: an entry another element reads or
// reads conditionally, a size off the scale, a line height that is not the
// step's (H3, where most Txt overrides are), and an entry next to another
// style that sets the same keys.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

import { applyEdits, runCodemod } from './codemod.mjs';
import { parse } from './imports.mjs';
import { loadTokens } from './tokens.mjs';

const MAP = JSON.parse(readFileSync(new URL('./migration-map.json', import.meta.url), 'utf8'));
const { SdsTypeScale } = loadTokens();
const LIFTED = ['fontSize', 'lineHeight', 'fontWeight'];

const propName = (n) => (n && (ts.isIdentifier(n) || ts.isStringLiteral(n)) ? n.text : null);
const unwrap = (n) => {
  while (n && (ts.isParenthesizedExpression(n) || ts.isAsExpression(n))) n = n.expression;
  return n;
};
const literalOf = (n) => {
  n = unwrap(n);
  if (n && ts.isNumericLiteral(n)) return Number(n.text);
  if (n && ts.isStringLiteral(n)) return n.text;
  return null;
};

function entriesOf(obj) {
  const m = new Map();
  if (!obj || !ts.isObjectLiteralExpression(obj)) return m;
  for (const p of obj.properties) if (ts.isPropertyAssignment(p) && propName(p.name)) m.set(propName(p.name), unwrap(p.initializer));
  return m;
}

/** Sheet binding name → (entry key → object literal), for StyleSheet.create and createThemedStyles sheets. */
function sheetsOf(sf) {
  const sheets = new Map();
  const hooks = new Map();
  (function visit(n) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && ts.isCallExpression(unwrap(n.initializer))) {
      const call = unwrap(n.initializer);
      const callee = call.expression.getText(sf);
      if (callee === 'StyleSheet.create') sheets.set(n.name.text, entriesOf(unwrap(call.arguments[0])));
      if (callee === 'createThemedStyles' && call.arguments[0] && (ts.isArrowFunction(call.arguments[0]) || ts.isFunctionExpression(call.arguments[0]))) {
        hooks.set(n.name.text, entriesOf(unwrap(call.arguments[0].body)));
      }
    }
    ts.forEachChild(n, visit);
  })(sf);
  const bound = new Map();
  (function visit(n) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && ts.isCallExpression(n.initializer) && hooks.has(n.initializer.expression.getText(sf))) {
      const hook = n.initializer.expression.getText(sf);
      const prev = bound.get(n.name.text);
      bound.set(n.name.text, prev === undefined || prev === hook ? hook : null);
    }
    ts.forEachChild(n, visit);
  })(sf);
  for (const [name, hook] of bound) if (hook && !sheets.has(name)) sheets.set(name, hooks.get(hook));
  return sheets;
}

/** The parts of a style expression: `{ ref, conditional }` for `x.k`, `{ inline }` for an object, `{ other }` otherwise. */
function partsOf(expr, conditional = false) {
  expr = unwrap(expr);
  if (!expr) return [];
  if (ts.isArrayLiteralExpression(expr)) return expr.elements.flatMap((e) => partsOf(e, conditional));
  if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression)) return [{ ref: expr, sheet: expr.expression.text, key: expr.name.text, conditional }];
  if (ts.isObjectLiteralExpression(expr)) return [{ inline: expr }];
  if (ts.isConditionalExpression(expr)) return [...partsOf(expr.whenTrue, true), ...partsOf(expr.whenFalse, true)];
  if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return partsOf(expr.right, true);
  if (expr.kind === ts.SyntaxKind.NullKeyword || expr.kind === ts.SyntaxKind.FalseKeyword || (ts.isIdentifier(expr) && expr.text === 'undefined')) return [];
  return [{ other: expr }];
}

function txtNames(sf) {
  const names = new Set();
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause?.namedBindings || !ts.isNamedImports(st.importClause.namedBindings)) continue;
    if (st.moduleSpecifier.text !== '@skkuverse/sds') continue;
    for (const el of st.importClause.namedBindings.elements) if ((el.propertyName ?? el.name).text === 'Txt') names.add(el.name.text);
  }
  return names;
}

/**
 * An edit that removes property `p` with its trailing comma, and the whole
 * line when nothing else is on it. Two removals never overlap.
 */
export function removeProp(sf, p) {
  const text = sf.getFullText();
  let start = p.getStart(sf);
  let end = p.getEnd();
  if (text[end] === ',') end++;
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  let lineEnd = text.indexOf('\n', end);
  if (lineEnd === -1) lineEnd = text.length;
  if (/^[ \t]*$/.test(text.slice(lineStart, start)) && /^[ \t]*$/.test(text.slice(end, lineEnd))) {
    start = lineStart;
    end = Math.min(lineEnd + 1, text.length);
  } else if (text[end] === ' ') end++;
  return { start, end, text: '' };
}

/** An edit that sets a string attribute on a JSX element, replacing it if present. */
function setAttr(sf, el, name, value) {
  const attr = el.attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText(sf) === name);
  if (attr) return { start: attr.getStart(sf), end: attr.getEnd(), text: `${name}="${value}"` };
  return { start: el.tagName.getEnd(), end: el.tagName.getEnd(), text: ` ${name}="${value}"` };
}

/** The transform runCodemod calls for one file. */
export function transform(file, text) {
  const sf = parse(file, text);
  const edits = [];
  const unresolved = [];
  const txt = txtNames(sf);
  if (!txt.size) return { edits, unresolved };
  const sheets = sheetsOf(sf);
  const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  // Every Txt element whose style reads an entry, keyed by `sheet.key`.
  const uses = new Map();
  const styleRefs = new Set();
  (function visit(n) {
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && txt.has(n.tagName.getText(sf))) {
      const attr = n.attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText(sf) === 'style');
      const expr = attr?.initializer && ts.isJsxExpression(attr.initializer) ? attr.initializer.expression : null;
      if (expr) {
        const parts = partsOf(expr);
        for (const part of parts) {
          if (!part.ref) continue;
          styleRefs.add(part.ref);
          const id = `${part.sheet}.${part.key}`;
          if (!uses.has(id)) uses.set(id, []);
          uses.get(id).push({ el: n, part, others: parts.filter((q) => q !== part) });
        }
      }
    }
    ts.forEachChild(n, visit);
  })(sf);
  for (const [id, list] of uses) {
    const [sheet, key] = id.split('.');
    const obj = sheets.get(sheet)?.get(key);
    if (!obj || !ts.isObjectLiteralExpression(obj)) continue;
    const props = new Map();
    for (const p of obj.properties) if (ts.isPropertyAssignment(p) && LIFTED.includes(propName(p.name))) props.set(propName(p.name), p);
    if (!props.size) continue;
    const at = line(obj);
    const leave = (reason) => unresolved.push({ line: at, reason: `${id}: ${reason}` });
    // Every read of the entry has to be one of these Txt styles.
    let elsewhere = 0;
    (function visit(n) {
      if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === sheet && n.name.text === key && !styleRefs.has(n)) elsewhere++;
      ts.forEachChild(n, visit);
    })(sf);
    if (elsewhere) {
      leave('read outside a Txt style');
      continue;
    }
    if (list.some((u) => u.part.conditional)) {
      leave('read conditionally');
      continue;
    }
    const othersSet = list.some((u) =>
      u.others.some((q) => {
        if (q.other) return true;
        const o = q.inline ?? sheets.get(q.sheet)?.get(q.key);
        if (!o || !ts.isObjectLiteralExpression(o)) return true;
        return o.properties.some((p) => ts.isSpreadAssignment(p) || (ts.isPropertyAssignment(p) && LIFTED.includes(propName(p.name))));
      }),
    );
    if (othersSet) {
      leave('another style on the same Txt sets a size, line height or weight, or cannot be read');
      continue;
    }
    const entryEdits = [];
    // Size and line height.
    const size = props.get('fontSize');
    const lh = props.get('lineHeight');
    if (size) {
      const value = literalOf(size.initializer);
      const entry = value === null ? null : MAP.fontSize[String(value)];
      if (!entry || !entry.exact) leave(entry ? `fontSize ${value}: ${entry.next} is not the same size` : `fontSize ${size.initializer.getText(sf)} is off the type scale`);
      else {
        const step = entry.next;
        const target = SdsTypeScale[step].lineHeight;
        const lhValue = lh ? literalOf(lh.initializer) : null;
        const typographies = list.map((u) => u.el.attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText(sf) === 'typography'));
        const before = typographies.map((a) => (a ? (a.initializer && ts.isStringLiteral(a.initializer) ? a.initializer.text : null) : 't7'));
        if (lh && lhValue !== target) leave(`lineHeight ${lh.initializer.getText(sf)} is not ${step}'s ${target} (H3)`);
        else if (!lh && before.some((t) => t === null || SdsTypeScale[t]?.lineHeight !== target)) leave(`a Txt draws another line height than ${step}'s ${target}`);
        else {
          entryEdits.push(removeProp(sf, size));
          if (lh) entryEdits.push(removeProp(sf, lh));
          for (const u of list) entryEdits.push(setAttr(sf, u.el, 'typography', step));
        }
      }
    } else if (lh) leave('a line height with no size stays (H3)');
    // Weight.
    const weight = props.get('fontWeight');
    if (weight) {
      const value = literalOf(weight.initializer);
      const entry = value === null ? null : MAP.fontWeight[String(value)];
      if (!entry || !entry.exact) leave(`fontWeight ${weight.initializer.getText(sf)} has no Txt weight of the same face`);
      else {
        entryEdits.push(removeProp(sf, weight));
        for (const u of list) entryEdits.push(setAttr(sf, u.el, 'fontWeight', entry.next));
      }
    }
    edits.push(...entryEdits);
  }
  if (!edits.length) return { edits, unresolved };
  return { edits: [{ start: 0, end: text.length, text: applyEdits(text, edits) }], unresolved };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) runCodemod({ name: 'txt-style-lift', transform });
