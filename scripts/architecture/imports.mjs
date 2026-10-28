// The import reading the cross-feature structure rules share (feature-cycles, type-seams):
// which feature a path is in, whether a declaration carries only types, and the repository
// path an import specifier names. Parsed with the TypeScript compiler, never by regex.
import { createRequire } from 'node:module';
import { dirname, join, normalize } from 'node:path';

const require = createRequire(import.meta.url);
export const ts = require('typescript');

export const MOBILE_SRC = 'apps/mobile/src/';
export const FEATURES = `${MOBILE_SRC}features/`;

/** The feature a repository path belongs to, or null outside features/. */
export function featureOf(path) {
  if (!path.startsWith(FEATURES)) return null;
  return path.slice(FEATURES.length).split('/')[0];
}

/** A parsed source file, TSX by its extension. */
export function parse(path, source) {
  return ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}

/** Whether an import or re-export declaration only carries types. */
export function isTypeOnly(node) {
  if (ts.isImportDeclaration(node)) {
    const clause = node.importClause;
    if (!clause) return false;
    if (clause.isTypeOnly) return true;
    const bindings = clause.namedBindings;
    if (clause.name || !bindings || !ts.isNamedImports(bindings)) return false;
    return bindings.elements.length > 0 && bindings.elements.every((e) => e.isTypeOnly);
  }
  if (ts.isExportDeclaration(node)) {
    if (node.isTypeOnly) return true;
    const clause = node.exportClause;
    return Boolean(clause && ts.isNamedExports(clause) && clause.elements.length > 0 && clause.elements.every((e) => e.isTypeOnly));
  }
  return false;
}

/** The module specifiers a file imports or re-exports at runtime. */
export function runtimeSpecifiers(path, source) {
  const file = parse(path, source);
  const specifiers = [];
  for (const node of file.statements) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      if (!isTypeOnly(node)) specifiers.push(node.moduleSpecifier.text);
    }
  }
  return specifiers;
}

/** The repository path a specifier names, from `from`, or null for a package. `exists` checks a candidate. */
export function resolveSpecifier(specifier, from, exists) {
  let base;
  if (specifier.startsWith('@/')) base = `${MOBILE_SRC}${specifier.slice(2)}`;
  else if (specifier.startsWith('.')) base = normalize(join(dirname(from), specifier));
  else return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (/\.(ts|tsx)$/.test(candidate) && exists(candidate)) return candidate;
  }
  return null;
}
