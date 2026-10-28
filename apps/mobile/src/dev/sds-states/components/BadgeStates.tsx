import React from 'react';
import type { BgColorName, FgColorName } from '@skkuverse/shared';
import { Badge, badgeVariantMap, useSemanticColors } from '@skkuverse/sds';
import { Group } from './Group';
import { Row } from './Row';

const TONES: readonly { name: string; color: FgColorName; backgroundColor: BgColorName }[] = [
  { name: 'neutral', color: 'neutralMuted', backgroundColor: 'neutralWeak' },
  { name: 'informative', color: 'informativeContrast', backgroundColor: 'informativeWeak' },
  { name: 'positive', color: 'positiveContrast', backgroundColor: 'positiveWeak' },
  { name: 'warning', color: 'warningContrast', backgroundColor: 'warningWeak' },
  { name: 'critical', color: 'criticalContrast', backgroundColor: 'criticalWeak' },
  { name: 'brand', color: 'onBrandSolid', backgroundColor: 'brandSolid' },
];

export function BadgeStates() {
  const color = useSemanticColors();
  return (
    <>
      {TONES.map((tone) => (
        <Group key={tone.name} label={`${tone.name} — size (badgeVariantMap)`}>
          <Row>
            {badgeVariantMap.size.map((size) => (
              <Badge key={size} size={size} color={tone.color} backgroundColor={tone.backgroundColor}>
                {size}
              </Badge>
            ))}
          </Row>
        </Group>
      ))}
      <Group label="A color value: bg.dataBrand, a route color's default">
        <Row>
          {badgeVariantMap.size.map((size) => (
            <Badge key={size} size={size} color={color.fg.onBrandSolid} backgroundColor={color.bg.dataBrand}>
              {size}
            </Badge>
          ))}
        </Row>
      </Group>
    </>
  );
}
