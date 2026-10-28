import React from 'react';
import { View } from 'react-native';
import {
  SdsRadius,
  SdsSpacing,
  SdsTypeScale,
  type SdsTypeScaleKey,
  type SemanticColors,
} from '@skkuverse/shared';
import { Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import { Caption } from './Caption';
import { Group } from './Group';

type ColorGroup = keyof SemanticColors;

const COLOR_GROUPS: readonly { group: ColorGroup; note: string }[] = [
  { group: 'fg', note: 'fg — text and icons (a dot of the color; on*Solid on its fill)' },
  { group: 'bg', note: 'bg — surfaces and fills' },
  { group: 'stroke', note: 'stroke — lines (a 2pt outline)' },
];

// WHY: the vendored token files keep TDS names as deprecated aliases; the scale is the SEED names only.
const SPACING_KEYS = (Object.keys(SdsSpacing) as (keyof typeof SdsSpacing)[]).filter((key) =>
  /^x\d/.test(key),
);
const RADIUS_KEYS = (Object.keys(SdsRadius) as (keyof typeof SdsRadius)[]).filter(
  (key) => /^r\d/.test(key) || key === 'full',
);
const TYPE_KEYS = Object.keys(SdsTypeScale) as SdsTypeScaleKey[];

const SPACING_BAR_SCALE = 3;

export function FoundationsStates() {
  return (
    <>
      {COLOR_GROUPS.map(({ group, note }) => (
        <Group key={group} label={note}>
          <ColorSwatches group={group} />
        </Group>
      ))}
      <Group label="Typography — t1…t13 (size / line height)">
        <TypeScale />
      </Group>
      <Group label={`Spacing — x* (bars at ${SPACING_BAR_SCALE}×)`}>
        <SpacingBars />
      </Group>
      <Group label="Radius — r* and full">
        <RadiusBoxes />
      </Group>
    </>
  );
}

function solidUnder(name: string, bg: Readonly<Record<string, string>>): string | undefined {
  const match = /^on([A-Z]\w*)Solid$/.exec(name);
  if (!match) return undefined;
  const role = match[1];
  return bg[`${role.charAt(0).toLowerCase()}${role.slice(1)}Solid`];
}

function ColorSwatches({ group }: { group: ColorGroup }) {
  const color = useSemanticColors();
  const styles = useStyles();
  const tokens = color[group] as Readonly<Record<string, string>>;
  return (
    <View style={styles.swatchGrid}>
      {Object.entries(tokens).map(([name, value]) => {
        const solid = group === 'fg' ? solidUnder(name, color.bg) : undefined;
        return (
          <View key={name} style={styles.swatchItem}>
            {solid !== undefined ? (
              <View style={[styles.swatch, styles.swatchOnSolid, { backgroundColor: solid }]}>
                <View style={[styles.swatchInnerDot, { backgroundColor: value }]} />
              </View>
            ) : group === 'fg' ? (
              <View style={[styles.swatch, styles.swatchDot, { backgroundColor: value }]} />
            ) : group === 'bg' ? (
              <View style={[styles.swatch, { backgroundColor: value }]} />
            ) : (
              <View style={[styles.swatch, styles.swatchStroke, { borderColor: value }]} />
            )}
            <View style={styles.swatchText}>
              <Txt typography="t2" fontWeight="medium" color="neutral" numberOfLines={2}>
                {`${group}.${name}`}
              </Txt>
              <Txt typography="t1" color="neutralSubtle">
                {value}
              </Txt>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function TypeScale() {
  const styles = useStyles();
  return (
    <View style={styles.stack}>
      {TYPE_KEYS.map((key) => {
        const { fontSize, lineHeight } = SdsTypeScale[key];
        return (
          <View key={key} style={styles.typeRow}>
            <View style={styles.typeLabel}>
              <Txt typography="t2" fontWeight="semiBold" color="neutral">
                {key}
              </Txt>
              <Txt typography="t1" color="neutralSubtle">
                {`${fontSize} / ${lineHeight}`}
              </Txt>
            </View>
            <Txt typography={key} color="neutral" style={styles.typeSample} numberOfLines={1}>
              다람쥐 헌 쳇바퀴 Aa 123
            </Txt>
          </View>
        );
      })}
    </View>
  );
}

function SpacingBars() {
  const styles = useStyles();
  return (
    <View style={styles.stack}>
      {SPACING_KEYS.map((key) => (
        <View key={key} style={styles.barRow}>
          <View style={styles.barLabel}>
            <Caption>{`${key} · ${SdsSpacing[key]}`}</Caption>
          </View>
          <View style={[styles.bar, { width: SdsSpacing[key] * SPACING_BAR_SCALE }]} />
        </View>
      ))}
    </View>
  );
}

function RadiusBoxes() {
  const styles = useStyles();
  return (
    <View style={styles.radiusGrid}>
      {RADIUS_KEYS.map((key) => (
        <View key={key} style={styles.radiusItem}>
          <View style={[styles.radiusBox, { borderRadius: SdsRadius[key] }]} />
          <Caption>{`${key} · ${SdsRadius[key]}`}</Caption>
        </View>
      ))}
    </View>
  );
}

const SWATCH = 28;
const RADIUS_BOX = 56;

const useStyles = createThemedStyles(({ color }) => ({
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: SdsSpacing.x2_5,
  },
  swatchItem: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x2,
    paddingRight: SdsSpacing.x2,
  },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: SdsRadius.r1_5,
    borderWidth: 1,
    borderColor: color.stroke.neutralSubtle,
  },
  swatchDot: {
    borderRadius: SdsRadius.full,
  },
  swatchOnSolid: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchInnerDot: {
    width: SWATCH / 2,
    height: SWATCH / 2,
    borderRadius: SdsRadius.full,
  },
  swatchStroke: {
    borderWidth: 2,
  },
  swatchText: {
    flex: 1,
  },
  stack: {
    gap: SdsSpacing.x2,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x3,
  },
  typeLabel: {
    width: SdsSpacing.x16,
  },
  typeSample: {
    flex: 1,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x3,
  },
  barLabel: {
    width: SdsSpacing.x16,
  },
  bar: {
    height: SdsSpacing.x3,
    borderRadius: SdsRadius.r0_5,
    backgroundColor: color.bg.brandSolid,
  },
  radiusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SdsSpacing.x4,
  },
  radiusItem: {
    alignItems: 'center',
    gap: SdsSpacing.x1,
  },
  radiusBox: {
    width: RADIUS_BOX,
    height: RADIUS_BOX,
    backgroundColor: color.bg.neutralWeak,
    borderWidth: 1,
    borderColor: color.stroke.neutralSolid,
  },
}));
