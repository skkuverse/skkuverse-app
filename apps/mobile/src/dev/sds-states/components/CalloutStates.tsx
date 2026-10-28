import React, { useState } from 'react';
import { View } from 'react-native';
import { SdsSpacing } from '@skkuverse/shared';
import { CaretRightIcon, InfoIcon } from 'phosphor-react-native';
import {
  ActionableCallout,
  Button,
  Callout,
  DismissibleCallout,
  Txt,
  calloutVariantMap,
  pressedBgToken,
  useResolvedScheme,
  type CalloutTone,
} from '@skkuverse/sds';
import { Caption } from './Caption';
import { Group } from './Group';
import { noop } from './catalog.constants';
import { useStaticPress } from './useStaticPress';
import { CALLOUT_RUN_SEPARATOR, CALLOUT_ROLES, CALLOUT_TEXT, calloutCatalog, txtSlot } from './catalog.rules';

const TONES = calloutVariantMap.tone;

const DESCRIPTION = 'A tinted note in the flow of a screen.';

export function CalloutStates() {
  const [dismissKey, setDismissKey] = useState(0);
  return (
    <>
      <Group label="Callout — prefixIcon · title · description · linkProps">
        <View style={stack}>
          {TONES.map((tone) => (
            <Callout
              key={tone}
              tone={tone}
              prefixIcon={<InfoIcon weight="fill" />}
              title={tone}
              description={DESCRIPTION}
              linkProps={{ children: 'Link', onPress: noop }}
            />
          ))}
          <Caption>description only</Caption>
          <Callout description="Notifications are off. Turn them on in Settings." />
        </View>
      </Group>

      <Group label="ActionableCallout — rest, then pressed (static)">
        <View style={stack}>
          {TONES.map((tone) => (
            <View key={tone} style={pairStack}>
              <ActionableCallout
                tone={tone}
                prefixIcon={<InfoIcon weight="fill" />}
                title={tone}
                description="The whole callout is one touch target."
                onPress={noop}
              />
              <StaticPressedActionableCallout
                tone={tone}
                title={`${tone} · pressed`}
                description="The whole callout is one touch target."
              />
            </View>
          ))}
        </View>
      </Group>

      <Group label="DismissibleCallout — press × to dismiss">
        <View style={stack}>
          {TONES.map((tone) => (
            <DismissibleCallout
              key={`${tone}-${dismissKey}`}
              tone={tone}
              prefixIcon={<InfoIcon weight="fill" />}
              title={tone}
              description={DESCRIPTION}
              dismissLabel="Close"
            />
          ))}
          <Button size="xsmall" tone="neutral" variant="weak" onPress={() => setDismissKey((key) => key + 1)}>
            Reset dismissed
          </Button>
        </View>
      </Group>
    </>
  );
}

const stack = { gap: SdsSpacing.x2 } as const;
const pairStack = { gap: SdsSpacing.x1 } as const;

function StaticPressedActionableCallout({
  tone,
  title,
  description,
}: {
  tone: CalloutTone;
  title: string;
  description: string;
}) {
  const scheme = useResolvedScheme();
  const styles = calloutCatalog.resolve(scheme, { tone });
  const surface = CALLOUT_ROLES[tone].surface;
  const press = useStaticPress({ bg: surface });
  const iconColor = typeof styles.content.color === 'string' ? styles.content.color : undefined;
  const prefixSize = typeof styles.prefixIcon.width === 'number' ? styles.prefixIcon.width : undefined;
  const suffixSize = typeof styles.suffixIcon.width === 'number' ? styles.suffixIcon.width : undefined;

  return (
    <View
      onLayout={press.onLayout}
      style={[styles.root, press.surface !== undefined && { backgroundColor: press.surface }, press.scaleStyle]}
      accessibilityLabel={`${tone} pressed (${pressedBgToken(surface)})`}
    >
      <View style={styles.prefixIcon}>
        <InfoIcon weight="fill" size={prefixSize} color={iconColor} />
      </View>
      <Txt typography={CALLOUT_TEXT.description.typography} style={txtSlot(styles.content)}>
        <Txt
          typography={CALLOUT_TEXT.title.typography}
          fontWeight={CALLOUT_TEXT.title.fontWeight}
          style={txtSlot(styles.title)}
        >
          {title}
          {CALLOUT_RUN_SEPARATOR}
        </Txt>
        <Txt
          typography={CALLOUT_TEXT.description.typography}
          fontWeight={CALLOUT_TEXT.description.fontWeight}
          style={txtSlot(styles.description)}
        >
          {description}
        </Txt>
      </Txt>
      <View style={styles.suffixIcon}>
        <CaretRightIcon size={suffixSize} color={iconColor} />
      </View>
    </View>
  );
}
