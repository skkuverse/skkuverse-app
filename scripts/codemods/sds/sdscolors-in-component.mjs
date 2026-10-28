#!/usr/bin/env node
// K3 and the V color batches: `SdsColors` reads, and color literals with a TDS
// value, inside a component, a hook or a themed sheet to roles.
//
//   node scripts/codemods/sds/sdscolors-in-component.mjs [--write] [--allow-dirty]
//     [--classes exact,C3,C4,C5] [--context <file.json>] [paths]
//
// A site moves when migration-map.json gives its use (fg, bg, stroke, … as
// the scanner reads it from the receiving key) one role, and that mapping's
// class is one of `--classes` (default `exact`, the K3 run):
//
// - exact: the role has the old light value, so nothing changes on screen.
// - C3: the role is within CIEDE2000 2 of it (a grey line becomes an alpha
//   stroke). The V1 batch.
// - C4: the role moves further (the brand text green, a grey icon). V2.
// - C5: the mapping is an inventory decision (`decision`, D-grey500-text and
//   the like) or depends on what the site draws (`byContext`). V3. A context
//   comes from `--context` (`{ "<file>:<line>": "surface" }`) or, for a grey
//   fill and a white fill, from the style's name, as the inventory read it:
//   a screen or section ground is a surface, a button or chip a control, and
//   a fill in a sheet, modal or popover floats.
//
// A color literal moves under the same rules when its value is a TDS name's
// light value (`#FFFFFF` reads as `background`); its class is measured from
// the literal itself.
//
// - `<Txt color={SdsColors.grey600}>` becomes `<Txt color="neutralSubtle">`:
//   Txt resolves a role name itself, so the component needs no hook.
// - in a component or hook any other read becomes `color.fg.neutralSubtle`,
//   with `const color = useSemanticColors();` as the first line of the
//   outermost component or hook. The name is `semantic` when `color` is
//   already taken there, and an existing `useSemanticColors()` binding is
//   reused. A read inside a useMemo, useCallback or effect adds the binding
//   to its dependency list.
// - in a createThemedStyles factory the read becomes `color.fg.…`, and a
//   factory that takes no argument gets `({ color })`.
// - an `SdsColors` import nothing reads any more is removed.
//
// What it leaves, listed in its report: a read whose use has no role in the
// classes asked for, a context nobody named, a read at module scope, in a
// StyleSheet, a helper or a class (K4, H1 or by hand), a parameter default, a
// component with an expression body, a hook callback whose dependency list
// is not an array literal, and every site on an always-dark surface (the
// video and photo viewers), which H2 moves under a dark-only scheme by hand.
import { readFileSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

import { runCodemod } from './codemod.mjs';
import { deltaE, parseColor } from './color.mjs';
import { addNamedImports, parse } from './imports.mjs';
import { loadTokens } from './tokens.mjs';

const MAP = JSON.parse(readFileSync(new URL('./migration-map.json', import.meta.url), 'utf8'));
const BY_PREVIOUS = new Map(MAP.colors.map((c) => [c.previous, c]));
const TOKENS = loadTokens();
const FALLBACK = { line: 'stroke', bgPressed: 'bg', placeholder: 'fg' };
const DEPS_HOOKS = new Set(['useMemo', 'useCallback', 'useEffect', 'useLayoutEffect', 'useImperativeHandle', 'useInsertionEffect']);
const FUNC_KINDS = new Set([
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.FunctionExpression,
  ts.SyntaxKind.ArrowFunction,
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.Constructor,
  ts.SyntaxKind.GetAccessor,
  ts.SyntaxKind.SetAccessor,
]);
const SDS_THEME = 'packages/sds/src/core/theme';
export const COLOR_CLASSES = ['exact', 'C3', 'C4', 'C5'];
/** Surfaces that stay dark in both modes: H2 moves them under a dark-only scheme by hand. */
const DARK_SURFACE = /VideoGalleryScreen|VideoPlayerScreen|BoardingPhotoViewer|PlaceGallery/;
// The inventory's reading of a fill by its style name (D-grey-fill).
const SURFACE_RE = /container|screen|root|page|safe|scroll|content|wrapper|wrap\b|body|list|section|layout|background|bg|sheet|modal|main|frame|outer|ground|area|stage|panel/i;
const CONTROL_RE = /chip|pill|badge|tag|button|btn|input|search|field|capsule|segment|track|skeleton|placeholder|thumb|avatar|icon|key|toggle|tab|bar|cell|box|card|tile|count|dot|circle|bubble|label|filter|option|action|pressed/i;

/** The light value a mapping's `next` names. */
function lightValue(next) {
  const [family, key, more] = next.split('.');
  if (family === 'SdsPalette' && key === 'static') return TOKENS.SdsPalette.static[more];
  return TOKENS.SdsSemanticColors.light[family]?.[key];
}

/** The migration-map entry for one TDS name put to one use (with the use fallbacks), or undefined. */
function entryFor(name, group) {
  const c = BY_PREVIOUS.get(`SdsColors.${name}`);
  if (!c) return undefined;
  return c.by[group] ?? (FALLBACK[group] ? c.by[FALLBACK[group]] : undefined);
}

/**
 * The batch class of moving `value` (a color string; the TDS name's own value
 * by default) to `next` under `entry`: C5 for a decided or context mapping,
 * else by distance: exact under 0.5, C3 under 2, C4 above.
 */
function classOf(entry, next, value) {
  if (entry.byContext || entry.decision) return 'C5';
  const d = deltaE(parseColor(value), parseColor(lightValue(next)));
  return d < 0.5 ? 'exact' : d < 2 ? 'C3' : 'C4';
}

/** The class of a TDS name put to a use, or null when the map names no replacement for it. */
export function colorClass(name, group) {
  const e = entryFor(name, group);
  if (!e || (!e.next && !e.byContext)) return null;
  if (e.byContext) return 'C5';
  return classOf(e, e.next, TOKENS.SdsColors[name]);
}

/**
 * The role one TDS name put to one use moves to, when its class is one of
 * `classes`: `{ next, cls }` (`fg.neutral`, 'exact'), or null. A context
 * mapping needs `context`; `value` is the color the site draws now (a
 * literal), the TDS name's light value by default.
 */
export function roleFor(name, group, { classes = ['exact'], context, value } = {}) {
  const e = entryFor(name, group);
  if (!e) return null;
  const next = e.byContext ? e.byContext[context] : e.next;
  if (!next || !/^(fg|bg|stroke)\.\w+$/.test(next)) return null;
  const cls = classOf(e, next, value ?? TOKENS.SdsColors[name]);
  if (!classes.includes(cls)) return null;
  return { next, cls };
}

/**
 * The migration-map entry for one TDS name put to one use, when it moves with
 * no change on screen: `{ next }` (`fg.neutral`), or null.
 */
export function exactRole(name, group) {
  const e = entryFor(name, group);
  if (!e || e.byContext) return null;
  const r = roleFor(name, group);
  return r && { next: r.next };
}

/** Whether the map's mapping for this name and use depends on a context. */
function needsContext(name, group) {
  return !!entryFor(name, group)?.byContext;
}

/** The context the style's name gives a grey or white fill, or undefined. */
export function contextFromName(name, group, record) {
  const label = `${record.styleKey ?? ''} ${record.sheetVar ?? ''}`.trim() || record.consumer || '';
  if (group === 'bg' && (name === 'grey100' || name === 'greyBackground')) {
    const control = CONTROL_RE.test(label);
    const surface = SURFACE_RE.test(label);
    if (control && !surface) return 'control';
    if (surface && !control) return 'surface';
    return undefined;
  }
  if (group === 'bg' && name === 'background') return record.sheet ? 'floating' : 'surface';
  return undefined;
}

/** Where `useSemanticColors` comes from: the package in the app, the theme module inside SDS. */
export function themeModuleFor(file) {
  if (!file.startsWith('packages/sds/src/')) return '@skkuverse/sds';
  let rel = relative(dirname(file), SDS_THEME);
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

function findNode(sf, start, end, test) {
  let found = null;
  (function visit(n) {
    if (found || n.getStart(sf) > start || n.getEnd() < end) return;
    if (n.getStart(sf) === start && n.getEnd() === end && test(n)) found = n;
    else ts.forEachChild(n, visit);
  })(sf);
  return found;
}

const unwrapParens = (n) => {
  while (n.parent && (ts.isParenthesizedExpression(n.parent) || ts.isAsExpression(n.parent))) n = n.parent;
  return n;
};

/** The outermost function around `node`. */
function outerFunction(node) {
  let outer = null;
  for (let p = node.parent; p; p = p.parent) if (FUNC_KINDS.has(p.kind)) outer = p;
  return outer;
}

/** Every identifier name bound or read in `fn` (property names after a dot and object keys aside). */
function namesIn(fn) {
  const names = new Set();
  (function visit(n) {
    if (ts.isIdentifier(n)) {
      const p = n.parent;
      const isMember = p && ts.isPropertyAccessExpression(p) && p.name === n;
      const isKey = p && (ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p)) && p.name === n;
      const isJsxAttr = p && ts.isJsxAttribute(p);
      if (!isMember && !isKey && !isJsxAttr) names.add(n.text);
    }
    ts.forEachChild(n, visit);
  })(fn);
  return names;
}

/** The name an existing top-level `const x = useSemanticColors()` in the body binds, or null. */
function existingBinding(body) {
  for (const st of body.statements) {
    if (!ts.isVariableStatement(st)) continue;
    for (const d of st.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && d.initializer && ts.isCallExpression(d.initializer) && d.initializer.expression.getText() === 'useSemanticColors') return d.name.text;
    }
  }
  return null;
}

/** The innermost React hook call with a dependency list whose callback holds `node`, or null. */
function depsHookOf(node, fn) {
  for (let p = node.parent; p && p !== fn; p = p.parent) {
    if (!FUNC_KINDS.has(p.kind)) continue;
    const call = p.parent;
    if (!call || !ts.isCallExpression(call) || call.arguments[0] !== p) continue;
    const callee = call.expression.getText().replace(/^React\./, '');
    if (DEPS_HOOKS.has(callee) && call.arguments.length >= 2) return call;
  }
  return null;
}

/** Whether `node` is the whole value of a Txt `color` attribute. */
function txtColorAttr(node, sf, txtNames) {
  const top = unwrapParens(node);
  const expr = top.parent;
  if (!expr || !ts.isJsxExpression(expr)) return null;
  const attr = expr.parent;
  if (!attr || !ts.isJsxAttribute(attr) || attr.name.getText(sf) !== 'color') return null;
  const el = attr.parent.parent;
  return txtNames.has(el.tagName.getText(sf)) ? attr : null;
}

/** The local names `Txt` is imported under, and the SdsColors import specifiers. */
function bindings(sf, file) {
  const txt = new Set();
  const sdsColors = [];
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause || st.importClause.isTypeOnly) continue;
    const mod = st.moduleSpecifier.text;
    const nb = st.importClause.namedBindings;
    if (!nb || !ts.isNamedImports(nb)) continue;
    for (const el of nb.elements) {
      const imported = (el.propertyName ?? el.name).text;
      const sdsMod = mod === '@skkuverse/sds' || (file.startsWith('packages/sds/src/') && /\/txt(\/Txt)?$|^\.\/Txt$/.test(mod));
      if (imported === 'Txt' && sdsMod) txt.add(el.name.text);
      if (imported === 'SdsColors' && (mod === '@skkuverse/shared' || mod.startsWith('@skkuverse/shared/') || mod.startsWith('.'))) sdsColors.push({ decl: st, el });
    }
  }
  return { txt, sdsColors };
}

/** Edits that drop `el` from its import, or the whole import when it was the only name. */
function removeSpecifier(sf, decl, el) {
  const nb = decl.importClause.namedBindings;
  const els = nb.elements;
  if (els.length === 1 && !decl.importClause.name) {
    // Take the line break before it, so an import added after it still has a point to land on.
    const text = sf.getFullText();
    const start = decl.getStart(sf);
    if (start > 0 && text[start - 1] === '\n') return [{ start: start - 1, end: decl.getEnd(), text: '' }];
    return [{ start, end: decl.getEnd() + (text[decl.getEnd()] === '\n' ? 1 : 0), text: '' }];
  }
  if (els.length === 1) return [{ start: decl.importClause.name.getEnd(), end: nb.getEnd(), text: '' }];
  const i = els.indexOf(el);
  if (i < els.length - 1) return [{ start: el.getStart(sf), end: els[i + 1].getStart(sf), text: '' }];
  return [{ start: els[i - 1].getEnd(), end: el.getEnd(), text: '' }];
}

/** The createThemedStyles factory `node` sits in, or null. */
function themedFactoryOf(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && p.expression.text === 'createThemedStyles') {
      const f = p.arguments[0];
      return f && (ts.isArrowFunction(f) || ts.isFunctionExpression(f)) ? f : null;
    }
  }
  return null;
}

/**
 * How a themed factory reaches the semantic colors: `{ prefix, edit }`, where
 * `prefix` is what a role read starts with (`color`, `theme.color`) and
 * `edit` is the parameter change it needs, or null when it cannot tell.
 */
function factoryAccess(sf, f) {
  if (f.parameters.length === 0) {
    if (referencesIn(f, 'color')) return null;
    return { prefix: 'color', edit: { start: f.parameters.pos, end: f.parameters.end, text: '{ color }' } };
  }
  const p = f.parameters[0];
  if (ts.isIdentifier(p.name)) return { prefix: `${p.name.text}.color`, edit: null };
  if (!ts.isObjectBindingPattern(p.name)) return null;
  for (const el of p.name.elements) {
    const key = (el.propertyName ?? el.name).getText(sf);
    if (key === 'color' && ts.isIdentifier(el.name)) return { prefix: el.name.text, edit: null };
  }
  if (referencesIn(f, 'color')) return null;
  const els = p.name.elements;
  if (!els.length) return { prefix: 'color', edit: { start: p.name.getStart(sf), end: p.name.getEnd(), text: '{ color }' } };
  const last = els[els.length - 1];
  return { prefix: 'color', edit: { start: last.getEnd(), end: last.getEnd(), text: ', color' } };
}

/** Whether `name` is read or bound anywhere in `root` (property names after a dot and keys aside). */
function referencesIn(root, name) {
  return namesIn(root).has(name);
}

/** The JSX attribute a string literal is the whole value of (`color="#FFF"`), or null. */
function bareAttr(node) {
  return node.parent && ts.isJsxAttribute(node.parent) && node.parent.initializer === node ? node.parent : null;
}

/** Whether `node` is the whole value of a Txt `color` attribute, as `{…}` or a bare string. */
function txtAttrOf(node, sf, txtNames) {
  const bare = bareAttr(node);
  if (bare) return bare.name.getText(sf) === 'color' && txtNames.has(bare.parent.parent.tagName.getText(sf)) ? bare : null;
  return txtColorAttr(node, sf, txtNames);
}

/**
 * The TDS name a literal reads as: the one with its exact light value, else
 * the nearest within CIEDE2000 2 of the same opacity (an opaque literal
 * never reads as an alpha name, nor a translucent one as an opaque name), or
 * null. A translucent color has to stay that close laid over black too, so
 * a white veil never reads as a grey tint, and a fully clear one reads as
 * nothing.
 */
export function tdsNameOf(hex) {
  const c = parseColor(hex);
  if (!c || c.a === 0) return null;
  const overBlack = (x) => ({ r: x.r * x.a, g: x.g * x.a, b: x.b * x.a, a: 1 });
  let best = null;
  for (const [name, v] of Object.entries(TOKENS.SdsColors)) {
    if (!BY_PREVIOUS.has(`SdsColors.${name}`)) continue;
    const t = parseColor(v);
    if ((t.a < 1) !== (c.a < 1)) continue;
    const d = deltaE(c, t);
    if (c.a < 1 && deltaE(overBlack(c), overBlack(t)) >= 2) continue;
    if (d < 2 && (!best || d < best.d)) best = { name, d };
  }
  return best?.name ?? null;
}

/**
 * The sites this run may move: each SdsColors read and each color literal
 * with a TDS value, as `{ r, name, label, isLiteral }`.
 */
function sitesOf(records) {
  const sites = [];
  for (const r of records.sdsColors) sites.push({ r, name: r.name, label: `SdsColors.${r.name}`, isLiteral: false });
  for (const r of records.colorLit ?? []) {
    const name = r.sdsName || tdsNameOf(r.hex);
    if (name) sites.push({ r, name, label: `${r.value} (${r.sdsName ? '' : '≈'}${name})`, isLiteral: true, value: r.hex });
  }
  return sites;
}

/**
 * The transform runCodemod calls for one file. `options.classes` are the
 * mapping classes to move (default exact) and `options.contexts` maps
 * `<file>:<line>` to a byContext key.
 */
export function transform(file, text, records, options = {}) {
  const classes = options.classes ?? ['exact'];
  const contexts = options.contexts ?? {};
  const sf = parse(file, text);
  const edits = [];
  const unresolved = [];
  const { txt, sdsColors } = bindings(sf, file);
  const perFunction = new Map(); // fn → { name, inject, reads }
  const factories = new Map(); // themed factory → access
  const depsAdds = new Map(); // deps array → Set(name)
  let movedSds = 0;
  for (const { r, name, label, isLiteral, value } of sitesOf(records)) {
    if (r.disabled) continue;
    if (DARK_SURFACE.test(file)) {
      unresolved.push({ line: r.line, reason: `${label}: an always-dark surface (H2)` });
      continue;
    }
    if (r.scope !== 'component' && r.scope !== 'hook' && r.scope !== 'themed') {
      unresolved.push({ line: r.line, reason: `${label}: ${r.scope} scope` });
      continue;
    }
    const context = contexts[`${file}:${r.line}`] ?? (needsContext(name, r.group) ? contextFromName(name, r.group, r) : undefined);
    const role = roleFor(name, r.group, { classes, context, value: isLiteral ? value : undefined });
    if (!role) {
      const why = needsContext(name, r.group) && classes.includes('C5') && !context ? 'no context named' : classes.join() === 'exact' ? 'no exact role' : `no role in ${classes.join(',')}`;
      unresolved.push({ line: r.line, reason: `${label} as ${r.group}: ${why}` });
      continue;
    }
    const node = findNode(sf, r.start, r.end, isLiteral ? (n) => ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) : ts.isPropertyAccessExpression);
    if (!node) {
      unresolved.push({ line: r.line, reason: `${label}: node not found` });
      continue;
    }
    const [family, key] = role.next.split('.');
    const attr = family === 'fg' ? txtAttrOf(node, sf, txt) : null;
    if (attr) {
      edits.push({ start: attr.initializer.getStart(sf), end: attr.initializer.getEnd(), text: `"${key}"` });
      if (!isLiteral) movedSds++;
      continue;
    }
    const wrap = (expr) => (bareAttr(node) ? `{${expr}}` : expr);
    if (r.scope === 'themed') {
      const f = themedFactoryOf(node);
      if (!f) {
        unresolved.push({ line: r.line, reason: `${label}: no createThemedStyles factory around it` });
        continue;
      }
      if (!factories.has(f)) factories.set(f, factoryAccess(sf, f));
      const access = factories.get(f);
      if (!access) {
        unresolved.push({ line: r.line, reason: `${label}: the factory's parameter does not give \`color\`` });
        continue;
      }
      edits.push({ start: node.getStart(sf), end: node.getEnd(), text: wrap(`${access.prefix}.${family}.${key}`) });
      access.used = true;
      if (!isLiteral) movedSds++;
      continue;
    }
    const fn = outerFunction(node);
    if (!fn || !fn.body || !ts.isBlock(fn.body)) {
      unresolved.push({ line: r.line, reason: `${label}: the component has no block body` });
      continue;
    }
    if (node.getStart(sf) < fn.body.getStart(sf)) {
      unresolved.push({ line: r.line, reason: `${label}: a parameter default, read before the body runs` });
      continue;
    }
    if (!perFunction.has(fn)) {
      const existing = existingBinding(fn.body);
      const taken = namesIn(fn);
      const bindName = existing ?? (!taken.has('color') ? 'color' : !taken.has('semantic') ? 'semantic' : null);
      perFunction.set(fn, { name: bindName, inject: !existing, reads: [] });
    }
    const slot = perFunction.get(fn);
    if (!slot.name) {
      unresolved.push({ line: r.line, reason: `${label}: both color and semantic are taken` });
      continue;
    }
    const hook = depsHookOf(node, fn);
    if (hook) {
      const deps = hook.arguments[1];
      if (!ts.isArrayLiteralExpression(deps)) {
        unresolved.push({ line: r.line, reason: `${label}: inside ${hook.expression.getText(sf)} with a dependency list that is not an array` });
        continue;
      }
      if (!deps.elements.some((e) => e.getText(sf) === slot.name)) {
        if (!depsAdds.has(deps)) depsAdds.set(deps, new Set());
        depsAdds.get(deps).add(slot.name);
      }
    }
    slot.reads.push({ start: node.getStart(sf), end: node.getEnd(), text: wrap(`${slot.name}.${family}.${key}`) });
    if (!isLiteral) movedSds++;
  }
  let needsHook = false;
  for (const [fn, slot] of perFunction) {
    if (!slot.reads.length) continue;
    edits.push(...slot.reads);
    if (slot.inject) {
      needsHook = true;
      const body = fn.body;
      const first = body.statements[0];
      const indent = first ? ' '.repeat(sf.getLineAndCharacterOfPosition(first.getStart(sf)).character) : '  ';
      const at = body.getStart(sf) + 1;
      edits.push({ start: at, end: at, text: `\n${indent}const ${slot.name} = useSemanticColors();${first ? '' : '\n'}` });
    }
  }
  for (const access of factories.values()) if (access?.used && access.edit) edits.push(access.edit);
  for (const [deps, names] of depsAdds) {
    const list = [...names].join(', ');
    const els = deps.elements;
    if (els.length) edits.push({ start: els[els.length - 1].getEnd(), end: els[els.length - 1].getEnd(), text: `, ${list}` });
    else edits.push({ start: deps.getStart(sf) + 1, end: deps.getStart(sf) + 1, text: list });
  }
  if (!edits.length) return { edits, unresolved };
  if (needsHook) edits.push(...addNamedImports(sf, ['useSemanticColors'], themeModuleFor(file)));
  // Drop the SdsColors import once nothing reads it.
  for (const { decl, el } of sdsColors) {
    const local = el.name.text;
    let reads = 0;
    (function visit(n) {
      if (ts.isIdentifier(n) && n.text === local && n !== el.name && !(ts.isPropertyAccessExpression(n.parent) && n.parent.name === n)) reads++;
      ts.forEachChild(n, visit);
    })(sf);
    if (reads > 0 && reads === movedSds) edits.push(...removeSpecifier(sf, decl, el));
  }
  return { edits, unresolved };
}

/** The options a command line gives: `--classes a,b` and `--context <file.json>`. */
export function optionsFrom(argv) {
  const at = (flag) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const classes = (at('--classes') ?? 'exact').split(',');
  for (const c of classes) if (!COLOR_CLASSES.includes(c)) throw new Error(`--classes: unknown class ${c} (${COLOR_CLASSES.join(', ')})`);
  const ctxFile = at('--context');
  const contexts = ctxFile ? JSON.parse(readFileSync(ctxFile, 'utf8')) : {};
  const rest = argv.filter((a, i) => !['--classes', '--context'].includes(a) && !['--classes', '--context'].includes(argv[i - 1]));
  return { classes, contexts, rest };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { classes, contexts, rest } = optionsFrom(process.argv.slice(2));
  runCodemod({ name: `sdscolors-in-component (${classes.join(',')})`, argv: rest, transform: (file, text, records) => transform(file, text, records, { classes, contexts }) });
}
