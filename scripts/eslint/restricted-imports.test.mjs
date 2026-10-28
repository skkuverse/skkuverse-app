// The root config's no-restricted-imports. Flat config replaces a rule's
// options per file, so a second block for the same rule would silently drop
// the useColorScheme ban wherever it matched; these cases pin that the ban
// holds in app code, beside the deep-import and deprecated-part bans.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { ESLint } = require('eslint');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const eslint = new ESLint({ cwd: root });

/** The no-restricted-imports reports for `code` linted as `file`. */
async function restricted(code, file) {
  const [result] = await eslint.lintText(code, { filePath: resolve(root, file) });
  return result.messages.filter((m) => m.ruleId === 'no-restricted-imports').length;
}

const APP = 'apps/mobile/src/features/bus/Probe.tsx';

describe('no-restricted-imports', () => {
  test('bans useColorScheme in app code', async () => {
    assert.equal(await restricted("import { useColorScheme } from 'react-native';\nexport const a = useColorScheme;\n", APP), 1);
  });

  test('bans a deep import and a deprecated part in app code', async () => {
    const code =
      "import { chipRecipe } from '@skkuverse/sds/src/components/chip/chipRecipe';\nimport { Result } from '@skkuverse/sds';\nexport const a = [chipRecipe, Result];\n";
    assert.equal(await restricted(code, APP), 2);
  });
});
