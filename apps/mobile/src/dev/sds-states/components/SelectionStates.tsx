import React, { useState } from 'react';
import { View } from 'react-native';
import { SdsSpacing } from '@skkuverse/shared';
import {
  Checkbox,
  SegmentedControl,
  Switch,
  Tab,
  Txt,
  checkboxVariantMap,
  segmentedControlVariantMap,
  tabVariantMap,
} from '@skkuverse/sds';
import { Caption } from './Caption';
import { Cell } from './Cell';
import { Group } from './Group';
import { Row } from './Row';

const CHECKBOX_PARTS = { line: Checkbox.Line, circle: Checkbox.Circle } as const;
const SEGMENTS = ['first', 'second', 'third'] as const;
const TABS = ['one', 'two', 'three', 'four', 'five'] as const;

export function SelectionStates() {
  const [on, setOn] = useState(true);
  const [segment, setSegment] = useState<string>(SEGMENTS[0]);
  const [tab, setTab] = useState<string>(TABS[0]);

  return (
    <>
      <Group label="Switch — off · on · disabled">
        <Row>
          <Cell caption="off">
            <Switch checked={false} />
          </Cell>
          <Cell caption="on">
            <Switch checked />
          </Cell>
          <Cell caption="live">
            <Switch checked={on} onCheckedChange={setOn} />
          </Cell>
          <Cell caption="disabled off">
            <Switch checked={false} disabled />
          </Cell>
          <Cell caption="disabled on">
            <Switch checked disabled />
          </Cell>
        </Row>
      </Group>

      <Group label="Checkbox — shape × disabled, off and on (checkboxVariantMap)">
        {checkboxVariantMap.shape.map((shape) => {
          const Part = CHECKBOX_PARTS[shape];
          return checkboxVariantMap.disabled.map((disabled) => (
            <Row key={`${shape}-${String(disabled)}`} label={`Checkbox.${shape === 'line' ? 'Line' : 'Circle'} · disabled=${String(disabled)}`}>
              <Part checked={false} disabled={disabled}>
                <Txt typography="t5">off</Txt>
              </Part>
              <Part checked disabled={disabled}>
                <Txt typography="t5">on</Txt>
              </Part>
            </Row>
          ));
        })}
      </Group>

      <Group label={`SegmentedControl — selected: ${segmentedControlVariantMap.selected.join(' · ')}`}>
        <SegmentedControl value={segment} onValueChange={setSegment}>
          {SEGMENTS.map((value) => (
            <SegmentedControl.Item key={value} value={value}>
              {value}
            </SegmentedControl.Item>
          ))}
        </SegmentedControl>
        <Caption>{`selected: ${segment}`}</Caption>
      </Group>

      <Group label="Tab — fluid × selected (tabVariantMap), redBean on the third, the last disabled">
        {tabVariantMap.fluid.map((fluid) => (
          <View key={String(fluid)} style={stack}>
            <Caption>{`fluid=${String(fluid)}`}</Caption>
            <Tab value={tab} onChange={setTab} fluid={fluid} size={fluid ? 'small' : 'large'}>
              {(fluid ? TABS : TABS.slice(0, 3)).map((value, index) => (
                <Tab.Item key={value} value={value} redBean={index === 2} disabled={index === (fluid ? TABS.length : 3) - 1}>
                  {value}
                </Tab.Item>
              ))}
            </Tab>
          </View>
        ))}
      </Group>
    </>
  );
}

const stack = { gap: SdsSpacing.x1_5 } as const;
