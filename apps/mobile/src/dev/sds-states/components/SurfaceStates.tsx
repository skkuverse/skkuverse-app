import React from 'react';
import { View } from 'react-native';
import { BellIcon, CaretRightIcon, MagnifyingGlassIcon, MapPinIcon, StackSimpleIcon } from 'phosphor-react-native';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';
import {
  GLASS_AVAILABLE,
  GlassButtonGroup,
  GlassCard,
  GlassChip,
  GlassIconButton,
  GlassSurface,
  Tossface,
  Txt,
  createThemedStyles,
  typographyMap,
  type TypographyKeys,
} from '@skkuverse/sds';
import { Caption } from './Caption';
import { Group } from './Group';
import { Row } from './Row';
import { noop } from './catalog.constants';

const STEPS = Object.keys(typographyMap) as TypographyKeys[];

export function SurfaceStates() {
  const styles = useStyles();
  return (
    <>
      <Group label="Txt — every step, regular">
        {STEPS.map((step) => (
          <Txt key={step} typography={step}>
            {step}
          </Txt>
        ))}
      </Group>

      <Group label="Tossface — the emoji font, sized">
        <Row>
          <Tossface size={16}>{'\u{1F4AC}'}</Tossface>
          <Tossface size={24}>{'\u{1F68C}'}</Tossface>
          <Tossface size={32}>{'\u{1F389}'}</Tossface>
        </Row>
      </Group>

      <Group label={`Glass — ${GLASS_AVAILABLE ? 'Liquid Glass' : 'the solid fallback (below iOS 26)'}`}>
        <View style={styles.glassGround}>
          <GlassSurface style={styles.glassSurface}>
            <Caption>GlassSurface</Caption>
          </GlassSurface>
          <GlassCard contentStyle={styles.glassCard}>
            <Txt typography="t4" fontWeight="semiBold">
              GlassCard
            </Txt>
          </GlassCard>
          <Row>
            <GlassIconButton icon={<BellIcon />} label="GlassIconButton" onPress={noop} />
            <GlassButtonGroup
              items={[
                { key: 'search', icon: <MagnifyingGlassIcon size={20} />, label: 'search', onPress: noop },
                { key: 'layers', icon: <StackSimpleIcon size={20} />, label: 'layers', onPress: noop },
              ]}
            />
            <GlassButtonGroup
              glass={false}
              items={[
                { key: 'search', icon: <MagnifyingGlassIcon size={20} />, label: 'search, white', onPress: noop },
                { key: 'layers', icon: <StackSimpleIcon size={20} />, label: 'layers, white', onPress: noop },
              ]}
            />
            <GlassChip icon={<MapPinIcon />} label="GlassChip" onPress={noop} />
            <GlassChip label="selected" selected onPress={noop} />
            <GlassChip label="accent" accent onPress={noop} />
            <GlassChip label="trailing" trailing={<CaretRightIcon size={12} />} onPress={noop} />
          </Row>
        </View>
      </Group>
    </>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  glassGround: {
    gap: SdsSpacing.x3,
    padding: SdsSpacing.x4,
    borderRadius: SdsRadius.r4,
    backgroundColor: color.bg.brandWeak,
  },
  glassSurface: {
    padding: SdsSpacing.x3,
    borderRadius: SdsRadius.r3,
  },
  glassCard: {
    padding: SdsSpacing.x4,
  },
}));
