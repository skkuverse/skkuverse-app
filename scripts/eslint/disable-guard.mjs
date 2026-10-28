#!/usr/bin/env node
// The second lint pass behind `yarn lint`: sds/require-disable-reason alone,
// with inline config off.
//
//   node scripts/eslint/disable-guard.mjs [paths]   (default: the whole repository)
//
// In the main pass an ESLint rule's report falls under the disable comments of
// its own file, so a comment that switches the meta rule off hides the report
// about that very comment: `/* eslint-disable */`, a block or same-line disable
// naming sds/require-disable-reason, or `/* eslint sds/require-disable-reason:
// off */`. This pass runs the meta rule with inline config off
// (`allowInlineConfig: false`, the API form of `--no-inline-config`), so no
// comment can silence it, and through ESLint's Node API, which in ESLint 9
// does not apply eslint-suppressions.json either, so recording the meta rule
// cannot silence it. Every other rule is off here: with inline config off, a
// legitimate disable of any other rule would no longer hold.
//
// The files, parsers and ignores are the root eslint.config.js's own: each of
// its blocks keeps everything but its rules. Results are cached under
// .expo/cache/, which is safe because the meta rule reads nothing but the file.
//
// Exit 0 when no comment breaks the rule, 1 when one does.
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const RULE = 'sds/require-disable-reason';

/**
 * The root config with every block's rules emptied, then the meta rule on. A
 * block keeps its (empty) `rules` key, so a block that pairs `ignores` with
 * rules never turns into a global ignore.
 */
export function guardConfig(rootConfig) {
  return [
    ...rootConfig.map((block) => (block.rules ? { ...block, rules: {} } : block)),
    { linterOptions: { reportUnusedDisableDirectives: 'off' }, rules: { [RULE]: 'error' } },
  ];
}

/** An ESLint instance that runs the guard pass from the repository root. */
export function guardEslint({ cache = false } = {}) {
  const { ESLint } = require('eslint');
  return new ESLint({
    cwd: repoRoot,
    overrideConfigFile: true,
    overrideConfig: guardConfig(require(resolve(repoRoot, 'eslint.config.js'))),
    allowInlineConfig: false,
    warnIgnored: false,
    cache,
    cacheLocation: resolve(repoRoot, '.expo/cache/eslint-disable-guard/'),
  });
}

async function main(paths) {
  const eslint = guardEslint({ cache: true });
  const results = await eslint.lintFiles(paths.length > 0 ? paths : ['.']);
  const problems = results.reduce((n, result) => n + result.errorCount + result.warningCount, 0);
  if (problems === 0) {
    console.log(`disable guard: ok, no comment switches off ${RULE}`);
    return 0;
  }
  const formatter = await eslint.loadFormatter('stylish');
  console.error(await formatter.format(results));
  console.error(`disable guard: these comments break ${RULE}, checked here with inline config off so no comment can hide it.`);
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await main(process.argv.slice(2));
}
