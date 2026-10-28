#!/usr/bin/env node
// Two read-only reports on the SDS lint debt and its exceptions (ADR 0016):
//
//   yarn sds:report                  node scripts/sds-report.mjs
//     The recorded total per rule in eslint-suppressions.json: the migration's
//     progress meter. Reads the record alone, so it is instant.
//
//   yarn sds:exceptions [paths]      node scripts/sds-report.mjs --exceptions [--all] [paths]
//     Every exception to an sds/* rule with its reason, and the recorded debt
//     beside it, each labelled. A line-level disable and its `-- reason` come
//     from ESLint's JSON output (`suppressions[].kind` is "directive"), a
//     registry entry from scripts/eslint/sds-exceptions.cjs, and the debt is
//     what the record suppressed (kind "file"), counted per file and rule.
//     Lints the given paths (default: the whole repository) without a cache.
//     --all lists every rule, not just sds/*.
//
// Exit 0 once the report is printed, 2 when ESLint produced no readable output.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RECORD = 'eslint-suppressions.json';

/** Per rule, the recorded count and how many files carry it, largest first. */
export function totalsByRule(record) {
  const totals = new Map();
  for (const rules of Object.values(record)) {
    for (const [rule, { count }] of Object.entries(rules)) {
      const t = totals.get(rule) ?? { rule, count: 0, files: 0 };
      t.count += count;
      t.files += 1;
      totals.set(rule, t);
    }
  }
  return [...totals.values()].sort((a, b) => b.count - a.count || a.rule.localeCompare(b.rule));
}

/**
 * The rows of the exceptions report from ESLint's JSON `results` and the
 * registry entries: `{ label, rule, location, reason, source }`, exceptions
 * first, then debt, each sorted by rule and location.
 */
export function exceptionRows(results, registry, { root = repoRoot, all = false } = {}) {
  const wanted = (rule) => typeof rule === 'string' && (all || rule.startsWith('sds/'));
  const toPosix = (path) => relative(root, path).split(sep).join('/');
  const exceptions = [];
  const debt = new Map();
  for (const result of results) {
    const file = toPosix(result.filePath);
    for (const message of result.suppressedMessages ?? []) {
      if (!wanted(message.ruleId)) continue;
      for (const suppression of message.suppressions ?? []) {
        if (suppression.kind === 'directive') {
          exceptions.push({
            label: 'exception',
            rule: message.ruleId,
            location: `${file}:${message.line}`,
            reason: suppression.justification || '(no reason given)',
            source: 'disable comment',
          });
        } else if (suppression.kind === 'file') {
          const key = `${file}\0${message.ruleId}`;
          const row = debt.get(key) ?? { label: 'debt', rule: message.ruleId, location: file, count: 0, source: RECORD };
          row.count += 1;
          debt.set(key, row);
        }
      }
    }
  }
  for (const entry of registry) {
    for (const rule of entry.rules.filter(wanted)) {
      for (const file of entry.files) {
        exceptions.push({ label: 'exception', rule, location: file, reason: entry.reason, source: 'registry' });
      }
    }
  }
  const byRuleThenLocation = (a, b) => a.rule.localeCompare(b.rule) || a.location.localeCompare(b.location, 'en', { numeric: true });
  const debtRows = [...debt.values()].map(({ count, ...row }) => ({
    ...row,
    reason: `${count} recorded violation${count === 1 ? '' : 's'}`,
  }));
  return [...exceptions.sort(byRuleThenLocation), ...debtRows.sort(byRuleThenLocation)];
}

/** Rows as aligned columns: label, rule, location, source, reason. */
export function formatRows(rows) {
  const columns = ['label', 'rule', 'location', 'source'];
  const widths = columns.map((c) => Math.max(...rows.map((row) => row[c].length)));
  return rows.map((row) => [...columns.map((c, i) => row[c].padEnd(widths[i])), row.reason].join('  ')).join('\n');
}

function report() {
  const path = join(repoRoot, RECORD);
  const record = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  const totals = totalsByRule(record);
  if (totals.length === 0) {
    console.log(`sds:report: no recorded violations (${existsSync(path) ? `${RECORD} is empty` : `no ${RECORD}`})`);
    return 0;
  }
  const width = Math.max(...totals.map((t) => t.rule.length));
  for (const t of totals) console.log(`${t.rule.padEnd(width)}  ${String(t.count).padStart(6)}  in ${t.files} files`);
  const sum = totals.reduce((n, t) => n + t.count, 0);
  console.log(`${'total'.padEnd(width)}  ${String(sum).padStart(6)}`);
  return 0;
}

function exceptions(args) {
  const all = args.includes('--all');
  const paths = args.filter((arg) => arg !== '--all');
  const eslintBin = join(dirname(require.resolve('eslint/package.json')), 'bin/eslint.js');
  const dir = mkdtempSync(join(tmpdir(), 'sds-exceptions-'));
  const out = join(dir, 'results.json');
  try {
    // Exit 1 (lint errors) or 2 (unpruned suppressions) still writes the
    // results, and the report is about them, not about passing.
    const run = spawnSync(process.execPath, [eslintBin, '--no-cache', '-f', 'json', '-o', out, ...(paths.length ? paths : ['.'])], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    let results;
    try {
      results = JSON.parse(readFileSync(out, 'utf8'));
    } catch {
      process.stderr.write(run.stderr ?? '');
      console.error('sds:exceptions: ESLint produced no results to read');
      return 2;
    }
    const registry = require('./eslint/sds-exceptions.cjs');
    const rows = exceptionRows(results, registry, { all });
    if (rows.length > 0) console.log(formatRows(rows));
    const count = (label) => rows.filter((row) => row.label === label).length;
    console.log(
      `sds:exceptions: ${count('exception')} exception${count('exception') === 1 ? '' : 's'}, ` +
        `${count('debt')} file and rule pair${count('debt') === 1 ? '' : 's'} of recorded debt` +
        (all ? ' (every rule)' : ' (sds/* rules)'),
    );
    return 0;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  process.exitCode = args[0] === '--exceptions' ? exceptions(args.slice(1)) : report();
}
