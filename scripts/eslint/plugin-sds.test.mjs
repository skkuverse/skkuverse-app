// The rules of the local `sds` ESLint plugin, through ESLint's RuleTester
// running under node:test.
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { RuleTester } = require('eslint');
const plugin = require('./plugin-sds.cjs');

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

// ESLint rejects a directive that names a rule it does not know, so every
// rule the cases name exists here as a rule that reports nothing.
const stub = { meta: { schema: [] }, create: () => ({}) };
const stubs = (...names) => ({ rules: Object.fromEntries(names.map((name) => [name, stub])) });

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } },
  plugins: {
    sds: stubs('no-color-literal', 'no-rn-text'),
    arch: stubs('file-size', 'feature-door'),
    react: stubs('no-unknown-property'),
    'react-hooks': stubs('exhaustive-deps', 'set-state-in-effect'),
  },
});

const reason = (rules) => ({ messageId: 'reason', data: { rules, min: '10' } });
const block = (rules) => ({ messageId: 'block', data: { rules } });

ruleTester.run('sds/require-disable-reason', plugin.rules['require-disable-reason'], {
  valid: [
    // The line-level form, with a reason, in every comment syntax ESLint reads.
    '// eslint-disable-next-line sds/no-color-literal -- data color from the server, not UI\nconst a = 1;',
    'const a = 1; // eslint-disable-line sds/no-color-literal -- data color from the server',
    '/* eslint-disable-next-line sds/no-color-literal -- data color from the server */\nconst a = 1;',
    'const el = (\n  <View>\n    {/* eslint-disable-next-line sds/no-rn-text -- primitive implementation */}\n    <Text />\n  </View>\n);',
    // Exactly the minimum length, and a reason after a longer dash run.
    '// eslint-disable-next-line sds/no-color-literal -- 0123456789\nconst a = 1;',
    '// eslint-disable-next-line sds/no-color-literal --- data color from the server\nconst a = 1;',
    // Several rules, the sds/* one among them, share the reason.
    '// eslint-disable-next-line react/no-unknown-property, sds/no-color-literal -- a library prop, data color\nconst a = 1;',
    // Any other rule takes a reason too, and may be disabled for a block or a file with one.
    '// eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, on mount\nconst a = 1;',
    'const a = 1; // eslint-disable-line react-hooks/exhaustive-deps -- runs once, on mount',
    '/* eslint-disable react-hooks/set-state-in-effect -- the whole file is a fixture */\nconst a = 1;',
    // Inline config of another rule is not this rule's business.
    '/* eslint no-console: off */\nconst a = 1;',
    // An arch/* rule takes the line-level form with a reason, as an sds/* rule does.
    '// eslint-disable-next-line arch/file-size -- a generated table of every station\nconst a = 1;',
    // Re-enabling is not a disable.
    '/* eslint-enable sds/no-rn-text */\nconst a = 1;',
    // ESLint ignores a range disable written as a line comment, so it disables nothing.
    '// eslint-disable sds/no-rn-text\nconst a = 1;',
    // Directive-shaped text that is not a comment.
    "const s = '/* eslint-disable sds/no-rn-text */';",
  ],
  invalid: [
    // Spec: a disable without a reason fails at that comment.
    {
      code: '// eslint-disable-next-line sds/no-color-literal\nconst a = 1;',
      errors: [{ ...reason('sds/no-color-literal'), line: 1 }],
    },
    { code: '// eslint-disable-next-line sds/no-color-literal -- too short\nconst a = 1;', errors: [reason('sds/no-color-literal')] },
    { code: '/* eslint-disable-next-line sds/no-color-literal -- */\nconst a = 1;', errors: [reason('sds/no-color-literal')] },
    { code: 'const a = 1; // eslint-disable-line sds/no-color-literal', errors: [reason('sds/no-color-literal')] },
    { code: '/* eslint-disable-next-line sds/no-rn-text */\nconst a = 1;', errors: [reason('sds/no-rn-text')] },
    {
      code: '// eslint-disable-next-line react-hooks/exhaustive-deps, sds/no-color-literal\nconst a = 1;',
      errors: [reason('react-hooks/exhaustive-deps, sds/no-color-literal')],
    },
    // Spec: every disable says why, whatever the rule.
    {
      code: '// eslint-disable-next-line react-hooks/exhaustive-deps\nconst a = 1;',
      errors: [{ ...reason('react-hooks/exhaustive-deps'), line: 1 }],
    },
    { code: 'const a = 1; // eslint-disable-line react-hooks/exhaustive-deps -- once', errors: [reason('react-hooks/exhaustive-deps')] },
    { code: '/* eslint-disable react-hooks/set-state-in-effect */\nconst a = 1;', errors: [reason('react-hooks/set-state-in-effect')] },
    { code: '// eslint-disable-next-line arch/file-size\nconst a = 1;', errors: [reason('arch/file-size')] },
    // An arch/* rule is governed as an sds/* rule is: no block, no inline config.
    {
      code: '/* eslint-disable arch/file-size -- the whole screen is one long form */\nconst a = 1;',
      errors: [block('arch/file-size')],
    },
    { code: '/* eslint arch/feature-door: off */\nconst a = 1;', errors: [{ messageId: 'inline' }] },
    // Spec: a file-wide disable fails, even with a reason.
    { code: '/* eslint-disable sds/no-rn-text */\nconst a = 1;', errors: [{ ...block('sds/no-rn-text'), line: 1 }] },
    {
      code: '/* eslint-disable sds/no-rn-text -- the whole file is a primitive implementation */\nconst a = 1;',
      errors: [block('sds/no-rn-text')],
    },
    {
      code: 'const a = 1;\n/* eslint-disable sds/no-rn-text, sds/no-color-literal */\nconst b = 2;\n/* eslint-enable sds/no-rn-text, sds/no-color-literal */',
      errors: [{ ...block('sds/no-rn-text, sds/no-color-literal'), line: 2 }],
    },
    // A disable that names no rule reaches every sds/* rule.
    { code: '// eslint-disable-next-line\nconst a = 1;', errors: [{ messageId: 'unnamed' }] },
    { code: '// eslint-disable-next-line -- no rule named, though a reason\nconst a = 1;', errors: [{ messageId: 'unnamed' }] },
    // Inline config is a fourth way to switch an sds/* rule off.
    { code: '/* eslint sds/no-rn-text: off */\nconst a = 1;', errors: [{ messageId: 'inline' }] },
    { code: '/* eslint no-console: 2, "sds/no-rn-text": 0 */\nconst a = 1;', errors: [{ messageId: 'inline' }] },
  ],
});
