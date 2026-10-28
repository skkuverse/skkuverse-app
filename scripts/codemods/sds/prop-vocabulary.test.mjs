// sds-7's prop-vocabulary codemod: an SDS component's legacy look props move
// to ADR 0015's names, sizes by height, and what the table cannot map is
// reported rather than guessed.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyEdits } from './codemod.mjs';
import { transform } from './prop-vocabulary.mjs';

const FILE = 'apps/mobile/src/features/demo/Demo.tsx';
const run = (text, file = FILE) => {
  const { edits, unresolved } = transform(file, text);
  return { out: applyEdits(text, edits), unresolved };
};

test('renames the Button props and maps sizes by height, in order', () => {
  const { out, unresolved } = run(
    [
      "import { Button } from '@skkuverse/sds';",
      'export const a = <Button type="dark" style="weak" size="medium">x</Button>;',
      "export const b = <Button type={on ? 'primary' : 'danger'} size={'big'}>x</Button>;",
      'export const c = <Button size="large" display="block">x</Button>;',
      '',
    ].join('\n'),
  );
  assert.deepEqual(unresolved, []);
  assert.equal(
    out,
    [
      "import { Button } from '@skkuverse/sds';",
      'export const a = <Button tone="neutral" variant="weak" size="small">x</Button>;',
      "export const b = <Button tone={on ? 'brand' : 'critical'} size={'large'}>x</Button>;",
      'export const c = <Button size="medium" display="block">x</Button>;',
      '',
    ].join('\n'),
  );
});

test('renames a dynamic value and reports it, and reports a value with no mapping', () => {
  const { out, unresolved } = run(
    [
      "import { Button as B } from '@skkuverse/sds';",
      'export const a = <B type={tone}>x</B>;',
      'export const b = <B type="light">x</B>;',
      '',
    ].join('\n'),
  );
  assert.equal(out.split('\n')[1], 'export const a = <B tone={tone}>x</B>;');
  assert.equal(out.split('\n')[2], 'export const b = <B tone="light">x</B>;');
  assert.deepEqual(
    unresolved.map((u) => u.line),
    [2, 3],
  );
});

test('leaves a component of the same name from elsewhere alone', () => {
  const text = "import { Button } from 'react-native';\nexport const a = <Button type=\"dark\" />;\n";
  assert.equal(run(text).out, text);
});

test('reaches a member tag and a relative import inside the package', () => {
  const { out } = run(
    [
      "import { ListRow } from '../list-row';",
      "import Badge from './Badge';",
      'export const a = <ListRow verticalPadding="extraSmall" contents={<ListRow.Texts type="2RowTypeA" top="t" bottom="b" />} />;',
      'export const b = <Badge size="tiny">x</Badge>;',
      '',
    ].join('\n'),
    'packages/sds/src/components/demo/Demo.tsx',
  );
  assert.match(out, /verticalPadding="xsmall"/);
  assert.match(out, /<ListRow\.Texts layout="2RowTypeA"/);
  assert.match(out, /<Badge size="xsmall">/);
});
