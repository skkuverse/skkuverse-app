// One ESLint flat config governs the whole repository: the root's.
//
// A config in a workspace directory takes over every file under it as soon as
// ESLint looks configs up per file (`v10_config_lookup_from_file`, the default
// from ESLint 10), and the root rules (the hand-off wrappers, the
// useColorScheme ban, the WantedSans and TDS-alias selectors) silently stop
// applying there. `apps/mobile/eslint.config.js` did exactly that until it was
// deleted. Workspace `lint` scripts run the root lint instead.
//
// Checks the filesystem rather than invoking ESLint: the files a commit can
// carry, meaning tracked ones plus untracked ones git does not ignore.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Every name ESLint accepts for a flat config file. */
const FLAT_CONFIG = /(^|\/)eslint\.config\.(js|mjs|cjs|ts|mts|cts)$/;

const configs = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
  cwd: root,
  encoding: 'utf8',
})
  .split('\0')
  .filter((path) => FLAT_CONFIG.test(path) && existsSync(join(root, path)));

test('no ESLint config exists outside the repository root', () => {
  const nested = configs.filter((path) => path.includes('/'));
  assert.deepEqual(
    nested,
    [],
    `ESLint config outside the root: ${nested.join(', ')}. Put the rule in the root eslint.config.js instead.`,
  );
});

test('the root has exactly one ESLint config', () => {
  assert.deepEqual(
    configs.filter((path) => !path.includes('/')),
    ['eslint.config.js'],
  );
});
