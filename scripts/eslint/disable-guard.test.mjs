// The guard pass (scripts/eslint/disable-guard.mjs): sds/require-disable-reason
// with inline config off, over the root config's files and parsers. Each
// bypass below passes the main lint pass, because the comment that breaks the
// meta rule also silences the meta rule's report about it; here it fails.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { guardConfig, guardEslint } from './disable-guard.mjs';

const eslint = guardEslint();
const filePath = 'apps/mobile/src/features/guard-fixture.tsx';

async function messages(code) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.map((m) => `${m.line}:${m.ruleId}`);
}

const violation = "export const color = '#123456';\n";

describe('the guard pass fails each comment that switches the meta rule off', () => {
  const bypasses = {
    'a bare block disable': `/* eslint-disable */\n${violation}`,
    'a bare block disable with a reason': `/* eslint-disable -- the whole file is generated */\n${violation}`,
    'a block disable naming the meta rule': `/* eslint-disable sds/require-disable-reason, sds/no-color-literal */\n${violation}`,
    'a same-line disable naming no rule': "export const color = '#123456'; // eslint-disable-line\n",
    'a same-line disable naming the meta rule':
      "export const color = '#123456'; // eslint-disable-line sds/no-color-literal, sds/require-disable-reason\n",
    'an inline config turning the meta rule off': `/* eslint sds/require-disable-reason: off, sds/no-color-literal: off */\n${violation}`,
  };
  for (const [name, code] of Object.entries(bypasses)) {
    test(name, async () => {
      assert.deepEqual(await messages(code), ['1:sds/require-disable-reason']);
    });
  }
});

describe('the guard pass leaves legitimate comments alone', () => {
  test('a line-level sds/* disable with a reason', async () => {
    assert.deepEqual(
      await messages(`// eslint-disable-next-line sds/no-color-literal -- a data color from the server\n${violation}`),
      [],
    );
  });

  test('a disable of another rule with a reason, which this pass does not run', async () => {
    const code =
      "import { useEffect } from 'react';\nexport function useX(a: number) {\n  // eslint-disable-next-line react-hooks/exhaustive-deps -- logs once, on mount\n  useEffect(() => console.log(a), []);\n}\n";
    assert.deepEqual(await messages(code), []);
  });
});

describe('the guard pass fails a disable of another rule that gives no reason', () => {
  test('a react-hooks disable without a reason', async () => {
    const code =
      "import { useEffect } from 'react';\nexport function useX(a: number) {\n  // eslint-disable-next-line react-hooks/exhaustive-deps\n  useEffect(() => console.log(a), []);\n}\n";
    assert.deepEqual(await messages(code), ['3:sds/require-disable-reason']);
  });
});

describe('the guard config', () => {
  test('empties every rule but keeps each block, so no block becomes a global ignore', () => {
    const config = guardConfig([
      { ignores: ['dist/**'] },
      { ignores: ['**/*.test.*'], rules: { 'no-restricted-syntax': 'error' } },
      { files: ['**/*.ts'], languageOptions: { ecmaVersion: 2024 } },
    ]);
    assert.deepEqual(config.slice(0, 3), [
      { ignores: ['dist/**'] },
      { ignores: ['**/*.test.*'], rules: {} },
      { files: ['**/*.ts'], languageOptions: { ecmaVersion: 2024 } },
    ]);
    assert.deepEqual(config[3].rules, { 'sds/require-disable-reason': 'error' });
  });
});
