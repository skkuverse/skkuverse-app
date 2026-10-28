import React from 'react';
import { View } from 'react-native';
import { SdsRadius, SdsSpacing, type BgColorName } from '@skkuverse/shared';
import {
  Pressable,
  Txt,
  createThemedStyles,
  useSemanticColors,
  type PressableBgToken,
  type PressFeedbackKind,
} from '@skkuverse/sds';
import { Caption } from './Caption';
import { Cell } from './Cell';
import { Group } from './Group';
import { Row } from './Row';
import { noop } from './catalog.constants';
import { useStaticPress } from './useStaticPress';

const FEEDBACKS: readonly PressFeedbackKind[] = ['both', 'color', 'scale', 'none'];

const SAMPLE_BG: PressableBgToken = 'neutralWeak';

function pressableTokens(bg: Readonly<Record<BgColorName, string>>): PressableBgToken[] {
  // eslint-disable-next-line sds/no-role-cast -- the catalog lists every role by name, and Object.keys returns strings
  const names = Object.keys(bg) as BgColorName[];
  // eslint-disable-next-line sds/no-role-cast -- a name with a -pressed pair is a PressableBgToken by that type's definition
  return names.filter((name) => names.includes(`${name}Pressed` as BgColorName)) as PressableBgToken[];
}

export function PressableStates() {
  const color = useSemanticColors();
  const styles = useStyles();
  const tokens = pressableTokens(color.bg);

  return (
    <>
      <Group label="bg — rest → pressed (the -pressed role, color only)">
        <View style={styles.pairGrid}>
          {tokens.map((token) => (
            <View key={token} style={styles.pairItem}>
              <View style={styles.pair}>
                <View style={[styles.pairBox, { backgroundColor: color.bg[token] }]} />
                <View style={[styles.pairBox, { backgroundColor: color.bg[`${token}Pressed`] }]} />
              </View>
              <Caption>{`bg.${token}`}</Caption>
            </View>
          ))}
        </View>
      </Group>

      <Group label={`feedback — rest, then pressed per mode (bg="${SAMPLE_BG}")`}>
        <Row>
          <Cell caption="rest">
            <View style={[styles.sample, { backgroundColor: color.bg[SAMPLE_BG] }]}>
              <Txt typography="t4" fontWeight="medium" color="neutral">
                Rest
              </Txt>
            </View>
          </Cell>
          {FEEDBACKS.map((feedback) => (
            <Cell key={feedback} caption={`pressed · ${feedback}`}>
              <StaticPressedSample bg={SAMPLE_BG} feedback={feedback} label={feedback} />
            </Cell>
          ))}
        </Row>
      </Group>

      <Group label='scaleScope="content" — the surface stays, the content shrinks'>
        <Caption>rest</Caption>
        <View style={[styles.wideRow, { backgroundColor: color.bg.layerDefault }]}>
          <View style={styles.wideContent}>
            <Txt typography="t6" color="neutral">
              A full-width row
            </Txt>
          </View>
        </View>
        <Caption>{'pressed (bg="layerDefault")'}</Caption>
        <StaticPressedWideRow />
      </Group>

      <Group label="Interactive — press and hold">
        <Row>
          {FEEDBACKS.map((feedback) => (
            <Pressable key={feedback} bg={SAMPLE_BG} feedback={feedback} style={styles.sample} onPress={noop}>
              <Txt typography="t4" fontWeight="medium" color="neutral">
                {feedback}
              </Txt>
            </Pressable>
          ))}
        </Row>
        <Row>
          <Pressable bg="brandSolid" style={styles.sample} onPress={noop}>
            <Txt typography="t4" fontWeight="medium" color="onBrandSolid">
              brandSolid
            </Txt>
          </Pressable>
          <Pressable bg="transparent" style={styles.sample} onPress={noop}>
            <Txt typography="t4" fontWeight="medium" color="neutral">
              transparent
            </Txt>
          </Pressable>
          <Pressable bg={SAMPLE_BG} disabled style={styles.sample} onPress={noop}>
            <Txt typography="t4" fontWeight="medium" color="disabled">
              disabled
            </Txt>
          </Pressable>
          <Pressable bg={SAMPLE_BG} loading style={styles.sample} onPress={noop}>
            <Txt typography="t4" fontWeight="medium" color="neutralSubtle">
              loading
            </Txt>
          </Pressable>
        </Row>
        <Pressable
          bg="layerDefault"
          scaleScope="content"
          style={styles.wideRow}
          contentStyle={styles.wideContent}
          onPress={noop}
        >
          <Txt typography="t6" color="neutral">
            A full-width row (content scale)
          </Txt>
        </Pressable>
      </Group>
    </>
  );
}

function StaticPressedSample({
  bg,
  feedback,
  label,
}: {
  bg: PressableBgToken;
  feedback: PressFeedbackKind;
  label: string;
}) {
  const styles = useStyles();
  const press = useStaticPress({ bg, feedback });
  return (
    <View
      onLayout={press.onLayout}
      style={[styles.sample, { backgroundColor: press.surface }, press.scaleStyle]}
    >
      <Txt typography="t4" fontWeight="medium" color="neutral">
        {label}
      </Txt>
    </View>
  );
}

function StaticPressedWideRow() {
  const styles = useStyles();
  const press = useStaticPress({ bg: 'layerDefault' });
  return (
    <View onLayout={press.onLayout} style={[styles.wideRow, { backgroundColor: press.surface }]}>
      <View style={[styles.wideContent, press.scaleStyle]}>
        <Txt typography="t6" color="neutral">
          A full-width row
        </Txt>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  pairGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: SdsSpacing.x3,
  },
  pairItem: {
    width: '50%',
    gap: SdsSpacing.x1,
    paddingRight: SdsSpacing.x2,
  },
  pair: {
    flexDirection: 'row',
    gap: SdsSpacing.x1,
  },
  pairBox: {
    flex: 1,
    height: SdsSpacing.x9,
    borderRadius: SdsRadius.r2,
    borderWidth: 1,
    borderColor: color.stroke.neutralSubtle,
  },
  sample: {
    minWidth: SdsSpacing.x16,
    height: SdsSpacing.x12,
    paddingHorizontal: SdsSpacing.x3,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SdsRadius.r3,
  },
  wideRow: {
    marginHorizontal: -SdsSpacing.x4,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: color.stroke.neutralSubtle,
  },
  wideContent: {
    paddingHorizontal: SdsSpacing.x4,
    paddingVertical: SdsSpacing.x4,
  },
}));
