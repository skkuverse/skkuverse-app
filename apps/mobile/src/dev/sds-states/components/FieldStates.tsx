import React, { useState } from 'react';
import { SearchField, TextField, textFieldVariantMap } from '@skkuverse/sds';
import { Group } from './Group';

export function FieldStates() {
  const [query, setQuery] = useState('');
  const [clearable, setClearable] = useState('Clear me');

  return (
    <>
      {textFieldVariantMap.variant.map((variant) => (
        <Group key={variant} label={`TextField variant="${variant}" — rest · invalid · disabled (tap one for focused)`}>
          {textFieldVariantMap.invalid.map((invalid) => (
            <TextField
              key={String(invalid)}
              variant={variant}
              label={invalid ? 'Invalid' : 'Label'}
              placeholder="Placeholder"
              hasError={invalid}
              help={invalid ? 'What went wrong, and how to fix it' : 'Help text'}
            />
          ))}
          <TextField variant={variant} label="Disabled" defaultValue="A value" disabled />
        </Group>
      ))}

      <Group label='TextField — labelOption="appear" · prefix and suffix · Clearable'>
        <TextField variant="box" label="Appears on focus" labelOption="appear" />
        <TextField variant="box" label="Amount" prefix="₩" suffix="KRW" keyboardType="numeric" />
        <TextField.Clearable variant="box" label="Clearable" value={clearable} onChangeText={setClearable} />
      </Group>

      <Group label="SearchField — with and without the clear button">
        <SearchField placeholder="Search" value={query} onChangeText={setQuery} />
        <SearchField placeholder="Search" defaultValue="A query" hasClearButton />
      </Group>
    </>
  );
}
