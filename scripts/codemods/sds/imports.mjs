// Import edits the codemods share: adding a named import from a module, and
// knowing which files a package import would break.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';

import { repoRoot } from './tokens.mjs';

/** The TypeScript source file for `text`, parsed as TSX when `file` is one. */
export function parse(file, text) {
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}

/**
 * The edits that make `names` importable from `module` in `sf`, or [] when
 * each one already is. A name joins the first value import from `module`;
 * with none, a new import line follows the last import.
 */
export function addNamedImports(sf, names, module) {
  const text = sf.getFullText();
  const decls = sf.statements.filter((s) => ts.isImportDeclaration(s) && s.moduleSpecifier.text === module);
  const bound = new Set();
  for (const d of decls) {
    const ic = d.importClause;
    if (!ic || ic.isTypeOnly || !ic.namedBindings || !ts.isNamedImports(ic.namedBindings)) continue;
    for (const el of ic.namedBindings.elements) if (!el.isTypeOnly && !el.propertyName) bound.add(el.name.text);
  }
  const missing = [...new Set(names)].filter((n) => !bound.has(n)).sort();
  if (!missing.length) return [];
  const host = decls.find((d) => d.importClause && !d.importClause.isTypeOnly && d.importClause.namedBindings && ts.isNamedImports(d.importClause.namedBindings));
  if (host) {
    const elements = host.importClause.namedBindings.elements;
    if (elements.length) {
      const last = elements[elements.length - 1];
      return [{ start: last.getEnd(), end: last.getEnd(), text: missing.map((n) => `, ${n}`).join('') }];
    }
    const nb = host.importClause.namedBindings;
    return [{ start: nb.getStart(sf) + 1, end: nb.getEnd() - 1, text: ` ${missing.join(', ')} ` }];
  }
  const imports = sf.statements.filter(ts.isImportDeclaration);
  const line = `import { ${missing.join(', ')} } from '${module}';`;
  if (imports.length) {
    const end = imports[imports.length - 1].getEnd();
    return [{ start: end, end, text: `\n${line}` }];
  }
  // No imports: after any leading comment block, before the first statement.
  const first = sf.statements[0];
  const at = first ? first.getStart(sf) : text.length;
  return [{ start: at, end: at, text: `${line}\n\n` }];
}

const toPosix = (p) => p.split(sep).join('/');

function walk(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith('.test.mts')) out.push(p);
  }
  return out;
}

let nodeTested;
/**
 * Repository paths a `node --experimental-strip-types` test imports. Those
 * files resolve their imports in plain Node, where `@skkuverse/shared` loads
 * React Native, so a codemod must not give them a package import.
 */
export function nodeTestedFiles(root = repoRoot) {
  if (nodeTested) return nodeTested;
  nodeTested = new Set();
  for (const dir of ['apps/mobile/app', 'apps/mobile/src', 'packages']) {
    for (const test of walk(resolve(root, dir), [])) {
      for (const m of readFileSync(test, 'utf8').matchAll(/from\s+'(\.[^']+)'/g)) nodeTested.add(toPosix(relative(root, resolve(dirname(test), m[1]))));
    }
  }
  return nodeTested;
}
