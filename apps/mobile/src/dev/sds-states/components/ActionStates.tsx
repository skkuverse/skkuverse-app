import React from 'react';
import { BellIcon } from 'phosphor-react-native';
import { IconButton, TextButton, iconButtonVariantMap, textButtonVariantMap } from '@skkuverse/sds';
import { Cell } from './Cell';
import { Group } from './Group';
import { Row } from './Row';
import { noop } from './catalog.constants';

export function ActionStates() {
  return (
    <>
      <Group label="TextButton — variant × disabled (textButtonVariantMap)">
        {textButtonVariantMap.disabled.map((disabled) => (
          <Row key={String(disabled)} label={`disabled=${String(disabled)}`}>
            {textButtonVariantMap.variant.map((variant) => (
              <TextButton key={variant} typography="t5" variant={variant} disabled={disabled} onPress={noop}>
                {variant}
              </TextButton>
            ))}
          </Row>
        ))}
        <Row label='color="placeholder" (a role) · fontWeight="bold"'>
          <TextButton typography="t5" variant="clear" color="placeholder" onPress={noop}>
            placeholder
          </TextButton>
          <TextButton typography="t5" variant="arrow" fontWeight="bold" onPress={noop}>
            bold
          </TextButton>
        </Row>
      </Group>

      <Group label="IconButton — variant × disabled (iconButtonVariantMap)">
        {iconButtonVariantMap.disabled.map((disabled) => (
          <Row key={String(disabled)} label={`disabled=${String(disabled)}`}>
            {iconButtonVariantMap.variant.map((variant) => (
              <Cell key={variant} caption={variant}>
                <IconButton icon={<BellIcon />} variant={variant} disabled={disabled} label={variant} onPress={noop} />
              </Cell>
            ))}
          </Row>
        ))}
      </Group>
    </>
  );
}
