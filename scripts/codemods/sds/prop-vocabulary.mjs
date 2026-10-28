#!/usr/bin/env node
// sds-7: the legacy SDS components' look props, moved to ADR 0015's
// vocabulary in one pass over every caller.
//
//   node scripts/codemods/sds/prop-vocabulary.mjs [--write] [--allow-dirty] [--only=Button,Loader] [paths]
//
// A look is `tone` (meaning) or `variant` (treatment), never `type`, and a
// size is a word step (`xsmall` < `small` < `medium` < `large`). RENAMES
// lists, per component, the props that move and each old value's new one.
// Sizes map by pixel height, in order, not by name: the Button's `large`
// (48pt) is SEED's `medium` step, its `big` (56pt) SEED's `large`.
//
// An element counts when its tag's root is bound to the component's import
// from `@skkuverse/sds`, or, inside packages/sds, from a relative path. Each
// listed attribute is renamed. A string value, a `{'…'}` value and each
// string branch of a `cond ? '…' : '…'` value are mapped; a value the table
// has no entry for, or any other expression, keeps its text and is reported,
// so the typecheck on the new union decides it.
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

import { runCodemod } from './codemod.mjs';

/** Component (tag) → old prop → `{ to, values }`. */
export const RENAMES = {
  Button: {
    type: { to: 'tone', values: { primary: 'brand', danger: 'critical', dark: 'neutral' } },
    style: { to: 'variant', values: { fill: 'solid', weak: 'weak' } },
    size: { to: 'size', values: { tiny: 'xsmall', medium: 'small', large: 'medium', big: 'large' } },
  },
  Loader: {
    type: { to: 'tone', values: { primary: 'brand', dark: 'neutral', light: 'staticWhite' } },
  },
  Border: {
    type: { to: 'variant', values: { full: 'full', padding24: 'padding24', height16: 'height16' } },
  },
  'ListRow.Texts': {
    type: {
      to: 'layout',
      values: Object.fromEntries(
        ['1RowTypeA', '1RowTypeB', '1RowTypeC', '2RowTypeA', '2RowTypeB', '2RowTypeC', '2RowTypeD', '2RowTypeE', '2RowTypeF', '3RowTypeA', '3RowTypeB', '3RowTypeC'].map((v) => [v, v]),
      ),
    },
  },
  ListRow: {
    verticalPadding: { to: 'verticalPadding', values: { extraSmall: 'xsmall', small: 'small', medium: 'medium', large: 'large' } },
  },
  Badge: {
    size: { to: 'size', values: { tiny: 'xsmall', small: 'small', medium: 'medium', large: 'large' } },
  },
  IconButton: {
    variant: { to: 'variant', values: { fill: 'weak', clear: 'ghost', border: 'outline' } },
  },
};

const ROOTS = new Set(Object.keys(RENAMES).map((tag) => tag.split('.')[0]));

/** `--only=A,B` keeps the run to those components (one commit per API surface). */
const only = process.argv.find((a) => a.startsWith('--only='))?.slice('--only='.length).split(',');

/** Local name → imported name, for the SDS components this file imports. */
function sdsBindings(sf, file) {
  const bindings = new Map();
  const insideSds = file.startsWith('packages/sds/');
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause || st.importClause.isTypeOnly) continue;
    const from = st.moduleSpecifier.text;
    if (from !== '@skkuverse/sds' && !(insideSds && /^\.\.?\//.test(from))) continue;
    const named = st.importClause.namedBindings;
    if (named && ts.isNamedImports(named)) {
      for (const el of named.elements) {
        const imported = (el.propertyName ?? el.name).text;
        if (ROOTS.has(imported)) bindings.set(el.name.text, imported);
      }
    }
    if (st.importClause.name && insideSds) {
      // `import Badge from './Badge'` inside the package.
      const local = st.importClause.name.text;
      if (ROOTS.has(local)) bindings.set(local, local);
    }
  }
  return bindings;
}

/** The component key a tag names (`ListRow.Texts`), or null. */
function tagKey(tagName, bindings) {
  const parts = [];
  let n = tagName;
  while (ts.isPropertyAccessExpression(n)) {
    parts.unshift(n.name.text);
    n = n.expression;
  }
  if (!ts.isIdentifier(n) || !bindings.has(n.text)) return null;
  const key = [bindings.get(n.text), ...parts].join('.');
  if (only && !only.includes(key)) return null;
  return RENAMES[key] ? key : null;
}

/** The string literals a value maps through: the literal itself, or each branch of a conditional. */
function stringLeaves(expr) {
  while (ts.isParenthesizedExpression(expr)) expr = expr.expression;
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return [expr];
  if (ts.isConditionalExpression(expr)) {
    const a = stringLeaves(expr.whenTrue);
    const b = stringLeaves(expr.whenFalse);
    return a && b ? [...a, ...b] : null;
  }
  return null;
}

export function transform(file, text) {
  if (!/\.tsx$/.test(file)) return { edits: [] };
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const bindings = sdsBindings(sf, file);
  const edits = [];
  const unresolved = [];
  if (bindings.size === 0) return { edits, unresolved };
  const lineOf = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const key = tagKey(node.tagName, bindings);
      if (key) {
        for (const attr of node.attributes.properties) {
          if (!ts.isJsxAttribute(attr)) continue;
          const rule = RENAMES[key][attr.name.getText(sf)];
          if (!rule) continue;
          if (rule.to !== attr.name.getText(sf)) {
            edits.push({ start: attr.name.getStart(sf), end: attr.name.getEnd(), text: rule.to });
          }
          const init = attr.initializer;
          const leaves = !init
            ? null
            : ts.isStringLiteral(init)
              ? [init]
              : ts.isJsxExpression(init) && init.expression
                ? stringLeaves(init.expression)
                : null;
          if (!leaves) {
            unresolved.push({ line: lineOf(attr), reason: `<${key} ${attr.name.getText(sf)}>: not a string value; left for the typecheck` });
            continue;
          }
          for (const leaf of leaves) {
            const to = rule.values[leaf.text];
            if (to === undefined) {
              unresolved.push({ line: lineOf(leaf), reason: `<${key} ${attr.name.getText(sf)}="${leaf.text}">: no mapping` });
            } else if (to !== leaf.text) {
              const quote = text[leaf.getStart(sf)];
              edits.push({ start: leaf.getStart(sf), end: leaf.getEnd(), text: `${quote}${to}${quote}` });
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { edits, unresolved };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCodemod({ name: 'prop-vocabulary', transform });
}
