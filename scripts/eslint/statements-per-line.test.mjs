// The root config's max-statements-per-line on app code: arch/file-size counts lines of code,
// so two statements joined on one line would dodge the budget. These cases pin that app code
// fails a joined line, and that code outside the app is not held to it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { ESLint } = require('eslint');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const eslint = new ESLint({ cwd: root });

/** The max-statements-per-line reports for `code` linted as `file`. */
async function joined(code, file) {
  const [result] = await eslint.lintText(code, { filePath: resolve(root, file) });
  return result.messages.filter((m) => m.ruleId === 'max-statements-per-line').length;
}

const JOINED = 'export const a = 1; export const b = 2;\n';

test('app code fails two statements joined on one line', async () => {
  // Act & Assert
  assert.equal(await joined(JOINED, 'apps/mobile/src/features/home/useProbe.ts'), 1);
  assert.equal(await joined(JOINED, 'apps/mobile/app/probe.tsx'), 1);
});

test('one statement per line passes', async () => {
  // Act & Assert
  assert.equal(await joined('export const a = 1;\nexport const b = 2;\n', 'apps/mobile/src/features/home/useProbe.ts'), 0);
});
