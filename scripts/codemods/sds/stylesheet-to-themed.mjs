#!/usr/bin/env node
// K4: a module StyleSheet that holds colors to createThemedStyles.
//
//   node scripts/codemods/sds/stylesheet-to-themed.mjs [--write] [--allow-dirty] [paths]
//
// A sheet moves when it is created at module level, is not exported, holds
// at least one color (an SdsColors read or a color literal), and every
// reference to it sits in a component or a hook with a block body:
//
//   const styles = StyleSheet.create({ … })
//     → const useStyles = createThemedStyles(({ color }) => ({ … }))
//
// and each component or hook that reads it starts with
// `const styles = useStyles();`. A sheet named `fooStyles` gets `useFooStyles`,
// and a sheet with no role to read yet gets a factory with no argument.
// Inside the sheet, an SdsColors read whose use has an exact role (as in K3)
// becomes `color.fg.neutral` and the like; every other color stays as it is,
// for a V batch to move inside the themed sheet. A reference inside a
// useMemo, useCallback or effect adds the sheet to its dependency list. A
// StyleSheet or SdsColors import nothing reads any more is removed.
//
// What it leaves, listed in its report: an exported sheet, one created inside
// a function, one read at module scope, in a helper or a class, a sheet whose
// hook name or `color` is already taken, and a component that already binds
// the sheet's name.
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

import { applyEdits, runCodemod } from './codemod.mjs';
import { addNamedImports, parse } from './imports.mjs';
import { exactRole, themeModuleFor } from './sdscolors-in-component.mjs';

const FUNC_KINDS = new Set([
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.FunctionExpression,
  ts.SyntaxKind.ArrowFunction,
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.Constructor,
  ts.SyntaxKind.GetAccessor,
  ts.SyntaxKind.SetAccessor,
]);
const DEPS_HOOKS = new Set(['useMemo', 'useCallback', 'useEffect', 'useLayoutEffect', 'useImperativeHandle', 'useInsertionEffect']);

/** The name a function is known by: its own, or the variable it is assigned to through calls (memo, forwardRef). */
function functionName(f) {
  if ((ts.isFunctionDeclaration(f) || ts.isFunctionExpression(f)) && f.name) return f.name.text;
  if (ts.isMethodDeclaration(f) || ts.isConstructorDeclaration(f) || ts.isGetAccessor(f) || ts.isSetAccessor(f)) return null;
  let p = f.parent;
  while (p && (ts.isCallExpression(p) || ts.isParenthesizedExpression(p) || ts.isAsExpression(p))) p = p.parent;
  if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;
  if (p && ts.isExportAssignment(p)) return 'Default';
  return null;
}

function outerFunction(node) {
  let outer = null;
  for (let p = node.parent; p; p = p.parent) if (FUNC_KINDS.has(p.kind)) outer = p;
  return outer;
}

function inClass(node) {
  for (let p = node.parent; p; p = p.parent) if (ts.isClassDeclaration(p) || ts.isClassExpression(p)) return true;
  return false;
}

const isComponentOrHook = (name) => !!name && (/^[A-Z]/.test(name) || /^use[A-Z0-9]/.test(name));

/** Identifier references to `name` (not a property name after a dot, an object key or a JSX attribute name). */
function referencesTo(root, name, skip) {
  const out = [];
  (function visit(n) {
    if (ts.isIdentifier(n) && n.text === name && n !== skip) {
      const p = n.parent;
      const isMember = ts.isPropertyAccessExpression(p) && p.name === n;
      const isKey = (ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p) || ts.isPropertySignature(p)) && p.name === n;
      const isJsxAttr = ts.isJsxAttribute(p);
      if (!isMember && !isKey && !isJsxAttr) out.push(n);
    }
    ts.forEachChild(n, visit);
  })(root);
  return out;
}

/** Whether `fn` declares `name` itself (a parameter or a local), so a new binding would clash. */
function declares(fn, name) {
  let found = false;
  (function visit(n) {
    if (found) return;
    if ((ts.isVariableDeclaration(n) || ts.isParameter(n) || ts.isBindingElement(n)) && ts.isIdentifier(n.name) && n.name.text === name) found = true;
    if ((ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) && n.name?.text === name) found = true;
    ts.forEachChild(n, visit);
  })(fn);
  return found;
}

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

/** `use` + the sheet name with a capital: styles → useStyles, brandStyles → useBrandStyles. */
export const hookNameFor = (sheetVar) => `use${sheetVar[0].toUpperCase()}${sheetVar.slice(1)}`;

/** Edits that drop an import specifier, or its whole import when it was the only name. */
function dropSpecifier(sf, decl, el) {
  const text = sf.getFullText();
  const nb = decl.importClause.namedBindings;
  const els = nb.elements;
  if (els.length === 1 && !decl.importClause.name) {
    const start = decl.getStart(sf);
    const end = decl.getEnd() + (text[decl.getEnd()] === '\n' ? 1 : 0);
    return { start, end, text: '' };
  }
  if (els.length === 1) return { start: decl.importClause.name.getEnd(), end: nb.getEnd(), text: '' };
  const i = els.indexOf(el);
  if (i < els.length - 1) return { start: el.getStart(sf), end: els[i + 1].getStart(sf), text: '' };
  return { start: els[i - 1].getEnd(), end: el.getEnd(), text: '' };
}

/** Removes the named value imports (`StyleSheet`, `SdsColors`) that `text` no longer reads. */
export function dropUnusedImports(file, text, names) {
  const sf = parse(file, text);
  const edits = [];
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause || st.importClause.isTypeOnly) continue;
    const nb = st.importClause.namedBindings;
    if (!nb || !ts.isNamedImports(nb)) continue;
    const gone = nb.elements.filter((el) => names.includes(el.name.text) && referencesTo(sf, el.name.text, el.name).length === 0);
    if (!gone.length) continue;
    if (gone.length === nb.elements.length && !st.importClause.name) {
      edits.push(dropSpecifier(sf, st, gone[0]));
      continue;
    }
    for (const el of gone) edits.push(dropSpecifier(sf, st, el));
  }
  return applyEdits(text, edits);
}

/** The transform runCodemod calls for one file. */
export function transform(file, text, records) {
  const sf = parse(file, text);
  const edits = [];
  const unresolved = [];
  const colorSheets = new Set([...records.sdsColors, ...records.colorLit].filter((r) => r.scope === 'stylesheet-module' && r.sheetVar).map((r) => r.sheetVar));
  const injections = new Map(); // fn → [line]
  const depsAdds = new Map(); // deps array → Set(name)
  let converted = 0;
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st)) continue;
    const exported = ts.getModifiers(st)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    for (const decl of st.declarationList.declarations) {
      const init = decl.initializer;
      if (!ts.isIdentifier(decl.name) || !init || !ts.isCallExpression(init) || init.expression.getText(sf) !== 'StyleSheet.create') continue;
      const sheetVar = decl.name.text;
      if (!colorSheets.has(sheetVar)) continue;
      const line = sf.getLineAndCharacterOfPosition(decl.getStart(sf)).line + 1;
      const leave = (reason) => unresolved.push({ line, reason: `${sheetVar}: ${reason}` });
      if (exported) {
        leave('exported');
        continue;
      }
      const hookName = hookNameFor(sheetVar);
      if (referencesTo(sf, hookName).length) {
        leave(`${hookName} is already taken`);
        continue;
      }
      const arg = init.arguments[0];
      if (!arg || !ts.isObjectLiteralExpression(arg) || init.arguments.length !== 1) {
        leave('its argument is not an object literal');
        continue;
      }
      if (referencesTo(arg, 'color').length) {
        leave('the sheet already reads a `color`');
        continue;
      }
      const refs = referencesTo(sf, sheetVar, decl.name);
      const blockers = [];
      const fns = new Map();
      for (const ref of refs) {
        const fn = outerFunction(ref);
        const at = sf.getLineAndCharacterOfPosition(ref.getStart(sf)).line + 1;
        if (!fn || inClass(ref)) blockers.push(`read at line ${at} outside a component`);
        else if (!isComponentOrHook(functionName(fn))) blockers.push(`read at line ${at} in ${functionName(fn) ?? 'an anonymous function'}`);
        else if (!fn.body || !ts.isBlock(fn.body)) blockers.push(`read at line ${at} in a component with no block body`);
        else if (declares(fn, sheetVar)) blockers.push(`${functionName(fn)} already binds ${sheetVar}`);
        else {
          if (!fns.has(fn)) fns.set(fn, []);
          fns.get(fn).push(ref);
        }
      }
      for (const [fn, fnRefs] of fns) {
        for (const ref of fnRefs) {
          const hook = depsHookOf(ref, fn);
          if (hook && !ts.isArrayLiteralExpression(hook.arguments[1])) blockers.push(`read inside ${hook.expression.getText(sf)} with a dependency list that is not an array`);
        }
      }
      if (blockers.length) {
        leave(blockers.join('; '));
        continue;
      }
      if (!refs.length) {
        leave('nothing reads it');
        continue;
      }
      // The sheet itself. With no role to read yet, the factory takes no argument.
      const roles = [];
      for (const r of records.sdsColors) {
        if (r.disabled || r.scope !== 'stylesheet-module' || r.sheetVar !== sheetVar) continue;
        const role = exactRole(r.name, r.group);
        if (role) roles.push({ start: r.start, end: r.end, text: `color.${role.next}` });
      }
      edits.push({ start: decl.name.getStart(sf), end: decl.name.getEnd(), text: hookName });
      edits.push({ start: init.getStart(sf), end: arg.getStart(sf), text: roles.length ? 'createThemedStyles(({ color }) => (' : 'createThemedStyles(() => (' });
      edits.push({ start: arg.getEnd(), end: init.getEnd(), text: '))' });
      edits.push(...roles);
      for (const [fn, fnRefs] of fns) {
        if (!injections.has(fn)) injections.set(fn, []);
        injections.get(fn).push(`const ${sheetVar} = ${hookName}();`);
        for (const ref of fnRefs) {
          const hook = depsHookOf(ref, fn);
          if (!hook) continue;
          const deps = hook.arguments[1];
          if (deps.elements.some((e) => e.getText(sf) === sheetVar)) continue;
          if (!depsAdds.has(deps)) depsAdds.set(deps, new Set());
          depsAdds.get(deps).add(sheetVar);
        }
      }
      converted++;
    }
  }
  if (!converted) return { edits: [], unresolved };
  for (const [fn, lines] of injections) {
    const first = fn.body.statements[0];
    const indent = first ? ' '.repeat(sf.getLineAndCharacterOfPosition(first.getStart(sf)).character) : '  ';
    const at = fn.body.getStart(sf) + 1;
    edits.push({ start: at, end: at, text: lines.map((l) => `\n${indent}${l}`).join('') + (first ? '' : '\n') });
  }
  for (const [deps, names] of depsAdds) {
    const list = [...names].join(', ');
    const els = deps.elements;
    if (els.length) edits.push({ start: els[els.length - 1].getEnd(), end: els[els.length - 1].getEnd(), text: `, ${list}` });
    else edits.push({ start: deps.getStart(sf) + 1, end: deps.getStart(sf) + 1, text: list });
  }
  edits.push(...addNamedImports(sf, ['createThemedStyles'], themeModuleFor(file)));
  const out = dropUnusedImports(file, applyEdits(text, edits), ['StyleSheet', 'SdsColors']);
  return { edits: [{ start: 0, end: text.length, text: out }], unresolved };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) runCodemod({ name: 'stylesheet-to-themed', transform });
