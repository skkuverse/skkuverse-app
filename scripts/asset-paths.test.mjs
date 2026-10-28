// Every relative asset path in app and package source points at a file.
//
// Typecheck resolves TypeScript imports but not a `require('./x.png')`, and the
// unit tests never bundle, so an asset path broken by moving its importer
// fails only when Metro bundles the screen. ADR 0020 migrations move files
// one folder deeper (into `components/`, into a sub-feature), which is exactly
// how such a path breaks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIRS = ['apps/mobile/src', 'apps/mobile/app', 'packages'];
const ASSET_PATH = /(?:require\(|from\s+|import\s+)['"](\.{1,2}\/[^'"]+\.(?:png|jpe?g|gif|webp|json|ttf|otf|mp4|svg|lottie))['"]/g;

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(tsx?|mts)$/.test(entry.name) ? [path] : [];
  });
}

/** Each `file -> asset path` whose target does not exist. */
export function missingAssets(files, read = (path) => readFileSync(path, 'utf8'), exists = existsSync) {
  return files.flatMap((file) =>
    [...read(file).matchAll(ASSET_PATH)]
      .filter((match) => !exists(resolve(dirname(file), match[1])))
      .map((match) => `${relative(root, file)} -> ${match[1]}`),
  );
}

test('a relative asset path that points nowhere is reported', () => {
  // Arrange
  const file = join(root, 'apps/mobile/src/features/x/components/Card.tsx');
  const read = () => "const a = require('../../../assets/a.png');\nimport b from './b.json';";
  const exists = (path) => path.endsWith('/b.json');

  // Act
  const missing = missingAssets([file], read, exists);

  // Assert
  assert.deepEqual(missing, ['apps/mobile/src/features/x/components/Card.tsx -> ../../../assets/a.png']);
});

test('every relative asset path in app and package source resolves', () => {
  // Act
  const missing = missingAssets(SOURCE_DIRS.flatMap((dir) => sourceFiles(join(root, dir))));

  // Assert
  assert.deepEqual(missing, []);
});
