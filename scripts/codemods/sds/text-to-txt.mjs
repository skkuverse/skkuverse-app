#!/usr/bin/env node
// V4, CM4: React Native's Text to SDS Txt.
//
//   node scripts/codemods/sds/text-to-txt.mjs [--write] [--allow-dirty] [paths]
//
// A `<Text>` (bound to react-native's Text) becomes `<Txt typography fontWeight>`
// when its style resolves to a font size on the type scale (migration-map.json;
// 10px folds to t1 as decided) and nothing it sets would fight Txt:
//
// - the style is a same-file sheet entry (StyleSheet.create or a
//   createThemedStyles sheet), an inline object, or an array of those, each
//   read unconditionally;
// - `fontSize` is a literal on the scale, or comes from a `...SdsTypo.t{n}{W}`
//   or `...SdsTypeScale.t{n}` spread;
// - `lineHeight` is absent or the step's own (Txt then draws the step's line
//   height, which a Text with none did not: the visual change this batch
//   ships), and there is no `letterSpacing` or `fontFamily`;
// - the weight is a `fontWeight` literal, a `...wantedSans('NNN')` spread or
//   the SdsTypo name's, and names a Txt weight.
//
// The type keys and spreads leave the style (Txt owns them), so every sheet
// entry it reads must be read only by Texts that convert; an entry or inline
// object left empty is removed with its reference. Color and layout stay in
// the style, which Txt lays over its own. The Text switches from the system
// face to WantedSans unless a spread already drew it.
//
// What it leaves, listed in its report: Animated.Text, a Text inside another
// Text (a span inherits its parent's type), a Text with no size, a size off
// the scale or from an expression, a line height that is not the step's (H3),
// letterSpacing or fontFamily, a conditional or unresolved style, and an
// entry shared with an element that does not convert. Files in packages/sds
// are left (Txt and Tossface are built on Text), and so is the error
// boundary, which renders above SDSProvider.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

import { applyEdits, runCodemod } from './codemod.mjs';
import { addNamedImports, parse } from './imports.mjs';
import { loadTokens } from './tokens.mjs';

const MAP = JSON.parse(readFileSync(new URL('./migration-map.json', import.meta.url), 'utf8'));
const { SdsTypeScale, SdsTypo } = loadTokens();
const TYPE_KEYS = new Set(['fontSize', 'lineHeight', 'fontWeight']);
const BLOCKING_KEYS = new Set(['letterSpacing', 'fontFamily']);
const OUTSIDE_SDS_PROVIDER = /\/bootstrap\/ErrorBoundary\.tsx$/;
const WEIGHT_BY_SUFFIX = { Regular: 'regular', Medium: 'medium', SemiBold: 'semibold', Bold: 'bold' };

const unwrap = (n) => {
  while (n && (ts.isParenthesizedExpression(n) || ts.isAsExpression(n))) n = n.expression;
  return n;
};
const propName = (n) => (n && (ts.isIdentifier(n) || ts.isStringLiteral(n)) ? n.text : null);

/** Sheet binding name → (entry key → property assignment), for StyleSheet.create and createThemedStyles sheets. */
function sheetsOf(sf) {
  const sheets = new Map();
  const hooks = new Map();
  const entries = (obj) => {
    const m = new Map();
    if (obj && ts.isObjectLiteralExpression(obj)) for (const p of obj.properties) if (ts.isPropertyAssignment(p) && propName(p.name)) m.set(propName(p.name), p);
    return m;
  };
  (function visit(n) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && ts.isCallExpression(unwrap(n.initializer))) {
      const call = unwrap(n.initializer);
      const callee = call.expression.getText(sf);
      if (callee === 'StyleSheet.create') sheets.set(n.name.text, entries(unwrap(call.arguments[0])));
      const f = call.arguments[0];
      if (callee === 'createThemedStyles' && f && (ts.isArrowFunction(f) || ts.isFunctionExpression(f))) hooks.set(n.name.text, entries(unwrap(f.body)));
    }
    ts.forEachChild(n, visit);
  })(sf);
  (function visit(n) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && ts.isCallExpression(n.initializer)) {
      const hook = n.initializer.expression.getText(sf);
      if (hooks.has(hook) && !sheets.has(n.name.text)) sheets.set(n.name.text, hooks.get(hook));
    }
    ts.forEachChild(n, visit);
  })(sf);
  return sheets;
}

/** The local names react-native's Text and SDS Txt are bound to. */
function bindings(sf) {
  const text = new Set();
  let txt = null;
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause || st.importClause.isTypeOnly) continue;
    const nb = st.importClause.namedBindings;
    if (!nb || !ts.isNamedImports(nb)) continue;
    for (const el of nb.elements) {
      const imported = (el.propertyName ?? el.name).text;
      if (st.moduleSpecifier.text === 'react-native' && imported === 'Text' && !el.isTypeOnly) text.add(el.name.text);
      if (st.moduleSpecifier.text === '@skkuverse/sds' && imported === 'Txt') txt = el.name.text;
    }
  }
  return { text, txt };
}

/** The style parts of an expression: `[{ entry, ref }]` / `[{ inline }]`, or null when one is conditional or unknown. */
function partsOf(expr, sf, sheets) {
  expr = unwrap(expr);
  if (ts.isArrayLiteralExpression(expr)) {
    const out = [];
    for (const el of expr.elements) {
      const p = partsOf(el, sf, sheets);
      if (!p) return null;
      out.push(...p);
    }
    return out;
  }
  if (ts.isObjectLiteralExpression(expr)) return [{ inline: expr }];
  if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression)) {
    const entry = sheets.get(expr.expression.text)?.get(expr.name.text);
    return entry ? [{ entry, ref: expr }] : null;
  }
  return null;
}

/** What one style object says about type: `{ size, lineHeight, weight, step, remove, blocked }`. */
function readObject(obj, sf, out) {
  for (const p of obj.properties) {
    if (ts.isSpreadAssignment(p)) {
      const e = unwrap(p.expression);
      const t = e.getText(sf);
      let m;
      if ((m = /^SdsTypo\.(t\d+)(Regular|Medium|SemiBold|Bold)$/.exec(t))) {
        out.step = m[1];
        out.spreadWeight = WEIGHT_BY_SUFFIX[m[2]];
        out.remove.push(p);
      } else if ((m = /^SdsTypeScale\.(t\d+)$/.exec(t))) {
        out.step = m[1];
        out.remove.push(p);
      } else if ((m = /^wantedSans\(\s*['"](\d00)['"]\s*\)$/.exec(t))) {
        out.weightLiteral = m[1];
        out.remove.push(p);
      } else out.blocked = `spread ${t}`;
      continue;
    }
    if (!ts.isPropertyAssignment(p)) {
      out.blocked = 'a shorthand or method in the style';
      continue;
    }
    const k = propName(p.name);
    if (BLOCKING_KEYS.has(k)) out.blocked = k;
    if (!TYPE_KEYS.has(k)) continue;
    const v = unwrap(p.initializer);
    let lit = ts.isNumericLiteral(v) ? Number(v.text) : ts.isStringLiteral(v) ? v.text : undefined;
    // A token read (`SdsTypo.t5Regular.lineHeight`, `SdsTypeScale.t5.fontSize`) is its value.
    const tok = /^(SdsTypo|SdsTypeScale)\.(\w+)\.(fontSize|lineHeight|fontWeight)$/.exec(v.getText(sf));
    if (lit === undefined && tok) lit = (tok[1] === 'SdsTypo' ? SdsTypo : SdsTypeScale)[tok[2]]?.[tok[3]];
    if (lit === undefined) out.blocked = `${k} is an expression`;
    else if (k === 'fontSize') out.size = lit;
    else if (k === 'lineHeight') out.lineHeight = lit;
    else out.weightLiteral = String(lit);
    out.remove.push(p);
  }
}

/** The edits that remove properties from an object literal, keeping the text tidy. */
function removeProps(sf, obj, props) {
  const text = sf.getFullText();
  const edits = [];
  for (const p of props) {
    let start = p.getFullStart();
    let end = p.getEnd();
    // Take the comma after it, or the one before it for the last property.
    let after = end;
    while (after < text.length && /[ \t]/.test(text[after])) after++;
    if (text[after] === ',') end = after + 1;
    else {
      let before = start;
      while (before > 0 && /\s/.test(text[before - 1])) before--;
      if (text[before - 1] === ',') start = before - 1;
    }
    edits.push({ start, end, text: '' });
  }
  void obj;
  // On one line, deleting the last properties leaves `a: 1, }`: take that comma too.
  return mergeDeletions(edits).map((e) => {
    let after = e.end;
    while (after < text.length && /[ \t]/.test(text[after])) after++;
    if (text[after] !== '}') return e;
    let before = e.start;
    while (before > 0 && /[ \t]/.test(text[before - 1])) before--;
    return text[before - 1] === ',' ? { ...e, start: before - 1 } : e;
  });
}

/** Overlapping deletions (two neighbours claiming one comma) merged into one. */
function mergeDeletions(edits) {
  const dels = edits.filter((e) => e.text === '').sort((a, b) => a.start - b.start);
  const rest = edits.filter((e) => e.text !== '');
  const out = [];
  for (const e of dels) {
    const last = out[out.length - 1];
    if (last && e.start < last.end) last.end = Math.max(last.end, e.end);
    else out.push({ ...e });
  }
  return [...rest, ...out];
}

/** The transform runCodemod calls for one file. */
export function transform(file, text) {
  const unresolved = [];
  if (file.startsWith('packages/sds/')) return { edits: [], unresolved };
  // The error boundary sits above SDSProvider, where a Txt has no theme to read.
  if (OUTSIDE_SDS_PROVIDER.test(file)) return { edits: [], unresolved: [{ line: 1, reason: 'renders above SDSProvider' }] };
  const sf = parse(file, text);
  const { text: textNames, txt } = bindings(sf);
  if (!textNames.size) return { edits: [], unresolved };
  const sheets = sheetsOf(sf);
  const candidates = [];
  const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  (function visit(n) {
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) {
      const open = ts.isJsxElement(n) ? n.openingElement : n;
      const tag = open.tagName.getText(sf);
      if (textNames.has(tag)) {
        const line = lineOf(n);
        const leave = (reason) => unresolved.push({ line, reason: `<${tag}>: ${reason}` });
        let parentText = false;
        for (let q = n.parent; q; q = q.parent) {
          if (ts.isJsxElement(q)) {
            const pt = q.openingElement.tagName.getText(sf);
            if (textNames.has(pt) || pt === txt || pt === 'Txt') parentText = true;
            break;
          }
          if (ts.isArrowFunction(q) || ts.isFunctionDeclaration(q) || ts.isFunctionExpression(q)) break;
        }
        const styleAttr = open.attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText(sf) === 'style');
        const hasTypeAttr = open.attributes.properties.some((a) => ts.isJsxAttribute(a) && ['typography', 'fontWeight'].includes(a.name.getText(sf)));
        if (parentText) leave('a span inside another Text inherits its type');
        else if (hasTypeAttr) leave('already sets typography or fontWeight');
        else if (!styleAttr || !styleAttr.initializer || !ts.isJsxExpression(styleAttr.initializer) || !styleAttr.initializer.expression) leave('no style, so no size');
        else {
          const parts = partsOf(styleAttr.initializer.expression, sf, sheets);
          if (!parts) leave('a conditional, spread or unresolved style');
          else {
            const info = { remove: [], blocked: null };
            for (const part of parts) readObject(part.inline ?? unwrap(part.entry.initializer), sf, info);
            if (!ts.isObjectLiteralExpression(unwrap(parts.find((p) => p.entry)?.entry.initializer) ?? ts.factory.createObjectLiteralExpression())) info.blocked = 'an entry that is not an object';
            let step = info.step;
            if (info.size !== undefined) {
              const m = MAP.fontSize[String(info.size)];
              step = m && (m.exact || m.decision) ? m.next : null;
            }
            const weightEntry = info.weightLiteral !== undefined ? MAP.fontWeight[info.weightLiteral] : null;
            const weight = info.weightLiteral !== undefined ? (weightEntry && weightEntry.exact ? weightEntry.next : null) : (info.spreadWeight ?? 'regular');
            if (info.blocked) leave(info.blocked);
            else if (!step) leave(info.size === undefined ? 'no font size' : `font size ${info.size} is off the scale (H3)`);
            else if (info.lineHeight !== undefined && info.lineHeight !== SdsTypeScale[step].lineHeight) leave(`line height ${info.lineHeight} is not ${step}'s ${SdsTypeScale[step].lineHeight} (H3)`);
            else if (!weight) leave(`font weight ${info.weightLiteral} names no Txt weight`);
            else candidates.push({ node: n, open, tag, line, step, weight, parts, styleAttr, remove: info.remove });
          }
        }
      }
    }
    ts.forEachChild(n, visit);
  })(sf);

  // An entry may lose its type keys only when every reference to it is a converting Text's style.
  const refsOf = new Map(); // entry → [PropertyAccessExpression]
  (function visit(n) {
    if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression)) {
      const entry = sheets.get(n.expression.text)?.get(n.name.text);
      if (entry) {
        if (!refsOf.has(entry)) refsOf.set(entry, []);
        refsOf.get(entry).push(n);
      }
    }
    ts.forEachChild(n, visit);
  })(sf);
  let changed = true;
  let live = candidates;
  while (changed) {
    changed = false;
    const ownRefs = new Set(live.flatMap((c) => c.parts.filter((p) => p.ref).map((p) => p.ref)));
    const next = [];
    for (const c of live) {
      const shared = c.parts.find((p) => p.entry && refsOf.get(p.entry).some((r) => !ownRefs.has(r)));
      if (shared) {
        unresolved.push({ line: c.line, reason: `<${c.tag}>: its style entry ${shared.ref.getText(sf)} is read by something else` });
        changed = true;
      } else next.push(c);
    }
    live = next;
  }
  if (!live.length) return { edits: [], unresolved };

  const edits = [];
  const txtName = txt ?? 'Txt';
  const removedFromEntry = new Map(); // entry → Set(prop)
  for (const c of live) {
    const attrs = ` typography="${c.step}"${c.weight === 'regular' ? '' : ` fontWeight="${c.weight}"`}`;
    edits.push({ start: c.open.tagName.getStart(sf), end: c.open.tagName.getEnd(), text: txtName + attrs });
    if (ts.isJsxElement(c.node)) edits.push({ start: c.node.closingElement.tagName.getStart(sf), end: c.node.closingElement.tagName.getEnd(), text: txtName });
    const emptied = [];
    for (const part of c.parts) {
      const obj = part.inline ?? unwrap(part.entry.initializer);
      const props = c.remove.filter((p) => p.parent === obj);
      const empty = props.length === obj.properties.length;
      if (part.inline) {
        if (empty) emptied.push(part.inline);
        else edits.push(...removeProps(sf, obj, props));
      } else {
        if (!removedFromEntry.has(part.entry)) removedFromEntry.set(part.entry, new Set());
        for (const p of props) removedFromEntry.get(part.entry).add(p);
        if (empty) emptied.push(part.ref);
      }
    }
    // A style left with nothing in it goes; a partly emptied array keeps the rest.
    const expr = unwrap(c.styleAttr.initializer.expression);
    if (emptied.length === c.parts.length) edits.push({ start: c.styleAttr.getFullStart(), end: c.styleAttr.getEnd(), text: '' });
    else if (emptied.length && ts.isArrayLiteralExpression(expr)) {
      // Rebuild the array from what is left, applying an inline object's removals to its own text.
      const keep = expr.elements.filter((el) => !emptied.includes(unwrap(el)));
      const textOf = (el) => {
        const obj = unwrap(el);
        const props = ts.isObjectLiteralExpression(obj) ? c.remove.filter((p) => p.parent === obj) : [];
        const base = el.getStart(sf);
        return applyEdits(el.getText(sf), removeProps(sf, obj, props).map((e) => ({ ...e, start: e.start - base, end: e.end - base })));
      };
      const body = keep.length === 1 ? textOf(keep[0]) : `[${keep.map(textOf).join(', ')}]`;
      // The inline removals already pushed sit inside the replaced array: drop them.
      const [lo, hi] = [expr.getStart(sf), expr.getEnd()];
      for (let i = edits.length - 1; i >= 0; i--) if (edits[i].start >= lo && edits[i].end <= hi) edits.splice(i, 1);
      edits.push({ start: lo, end: hi, text: body });
    }
  }
  for (const [entry, props] of removedFromEntry) {
    const obj = unwrap(entry.initializer);
    if (props.size === obj.properties.length) {
      // The entry is empty now: drop it from its sheet.
      edits.push(...removeProps(sf, entry.parent, [entry]));
    } else edits.push(...removeProps(sf, obj, [...props]));
  }
  if (!txt) edits.push(...addNamedImports(sf, ['Txt'], '@skkuverse/sds'));
  let out = applyEdits(text, mergeDeletions(edits));
  out = dropUnused(file, out, ['Text', 'wantedSans', 'SdsTypo', 'SdsTypeScale']);
  return { edits: [{ start: 0, end: text.length, text: out }], unresolved };
}

/** Removes the named value imports `text` no longer reads. */
function dropUnused(file, text, names) {
  const sf = parse(file, text);
  const read = new Set();
  (function visit(n) {
    if (ts.isIdentifier(n) && !(n.parent && ts.isImportSpecifier(n.parent))) {
      const p = n.parent;
      if (!(ts.isPropertyAccessExpression(p) && p.name === n) && !(ts.isPropertyAssignment(p) && p.name === n)) read.add(n.text);
    }
    ts.forEachChild(n, visit);
  })(sf);
  const edits = [];
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause || st.importClause.isTypeOnly) continue;
    const nb = st.importClause.namedBindings;
    if (!nb || !ts.isNamedImports(nb)) continue;
    const gone = nb.elements.filter((el) => names.includes(el.name.text) && !read.has(el.name.text));
    if (!gone.length) continue;
    if (gone.length === nb.elements.length && !st.importClause.name) {
      const end = st.getEnd() + (text[st.getEnd()] === '\n' ? 1 : 0);
      edits.push({ start: st.getStart(sf), end, text: '' });
      continue;
    }
    // Drop each name with the comma after it (or before it, for the last), keeping the layout.
    for (const el of gone) {
      const i = nb.elements.indexOf(el);
      const els = nb.elements;
      if (i < els.length - 1) edits.push({ start: el.getStart(sf), end: els[i + 1].getStart(sf), text: '' });
      else {
        const prev = els.filter((x) => !gone.includes(x)).pop();
        const from = prev ? Math.max(prev.getEnd(), ...gone.filter((g) => els.indexOf(g) < i).map((g) => g.getEnd())) : el.getStart(sf);
        edits.push({ start: from, end: el.getEnd(), text: '' });
      }
    }
  }
  return applyEdits(text, mergeDeletions(edits));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) runCodemod({ name: 'text-to-txt', transform });
