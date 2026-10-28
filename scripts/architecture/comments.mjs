// `node scripts/architecture/comments.mjs [--report | --check] [path...]` runs the comment rules
// (docs/decisions/0026-comments-say-only-what-the-code-cannot.md) over the tree or the given paths.
// --report (the default) always exits 0; --check (`yarn test:comments`) exits 1 on any violation.
import { relative, resolve, sep } from 'node:path';
import { repoRoot } from './ratchet.mjs';
import { formatReport, treeViolations } from './comments/tree.mjs';

const args = process.argv.slice(2);
const unknown = args.filter((arg) => arg.startsWith('--') && arg !== '--report' && arg !== '--check');
const paths = args.filter((arg) => !arg.startsWith('--'));
if (unknown.length > 0) {
  console.error('usage: node scripts/architecture/comments.mjs [--report | --check] [path...]');
  process.exit(2);
}
const rels = paths.map((path) => relative(repoRoot, resolve(process.cwd(), path)).split(sep).join('/'));
const violations = treeViolations(rels);
console.log(formatReport(violations));
process.exitCode = args.includes('--check') && violations.length > 0 ? 1 : 0;
