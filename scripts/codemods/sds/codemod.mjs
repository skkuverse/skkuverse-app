// The driver every SDS codemod runs through: it picks the files a codemod may
// write (files.mjs: never exclude.json, never a file with uncommitted changes
// unless --allow-dirty), scans them, hands each file and its records to the
// codemod's transform, and either prints the diff (the default, a dry run) or
// writes the files (--write). Every site a transform leaves alone comes back
// in its report with the reason, as does every file it was not allowed to
// touch.
//
// A codemod is a module that calls runCodemod:
//
//   runCodemod({
//     name: 'spacing-radius-literal',
//     transform(file, text, records) {
//       // records: this file's scan (scan.mjs), e.g. records.spacing
//       return { edits: [{ start, end, text }], unresolved: [{ line, reason }] };
//     },
//   });
//
//   node scripts/codemods/sds/<codemod>.mjs [--write] [--allow-dirty] [paths]
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { writableFiles } from './files.mjs';
import { scanContext, scanSource } from './scan.mjs';
import { repoRoot } from './tokens.mjs';

/** `text` with each `{ start, end, text }` edit applied. Edits must not overlap. */
export function applyEdits(text, edits) {
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].end > sorted[i - 1].start) throw new Error(`overlapping edits at ${sorted[i].start}..${sorted[i].end} and ${sorted[i - 1].start}..${sorted[i - 1].end}`);
  }
  let out = text;
  for (const e of sorted) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}

/** A unified diff of one file's change, labelled with its repository path. */
export function unifiedDiff(file, before, after) {
  const dir = mkdtempSync(join(tmpdir(), 'sds-codemod-'));
  try {
    writeFileSync(join(dir, 'a'), before);
    writeFileSync(join(dir, 'b'), after);
    const out = spawnSync('diff', ['-u', '--label', `a/${file}`, '--label', `b/${file}`, join(dir, 'a'), join(dir, 'b')], { encoding: 'utf8' });
    return out.stdout;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Runs `transform` over the writable files. Returns
 * `{ changed: [{ file, edits }], unresolved: [{ file, line, reason }], skipped: [{ path, reason }] }`
 * after printing the diff (dry run) or writing the files.
 */
export function runCodemod({ name, transform, argv = process.argv.slice(2), root = repoRoot, log = console.log }) {
  const write = argv.includes('--write');
  const allowDirty = argv.includes('--allow-dirty');
  const paths = argv.filter((a) => !a.startsWith('--'));
  const { files, skipped } = writableFiles({ candidates: paths.length ? paths : undefined, allowDirty, root });
  const context = scanContext();
  const changed = [];
  const unresolved = [];
  for (const file of files) {
    const before = readFileSync(resolve(root, file), 'utf8');
    const result = transform(file, before, scanSource(file, before, context)) ?? {};
    for (const u of result.unresolved ?? []) unresolved.push({ file, ...u });
    if (!result.edits?.length) continue;
    const after = applyEdits(before, result.edits);
    if (after === before) continue;
    changed.push({ file, edits: result.edits.length });
    if (write) writeFileSync(resolve(root, file), after);
    else log(unifiedDiff(file, before, after));
  }
  log(`${name}: ${write ? 'wrote' : 'would change'} ${changed.length} files, ${changed.reduce((s, c) => s + c.edits, 0)} edits${write ? '' : ' (dry run; --write to apply)'}`);
  if (unresolved.length) {
    log(`left unchanged (${unresolved.length}):`);
    for (const u of unresolved) log(`  ${u.file}:${u.line}  ${u.reason}`);
  }
  if (skipped.length) {
    log(`not touched (${skipped.length}):`);
    for (const s of skipped) log(`  ${s.path}  ${s.reason}`);
  }
  return { changed, unresolved, skipped };
}
