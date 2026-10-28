import React from 'react';
import { View } from 'react-native';
import { CaretDownIcon, LinkSimpleIcon } from 'phosphor-react-native';
import { SdsSpacing } from '@skkuverse/shared';
import {
  Chip,
  Txt,
  chipVariantMap,
  useResolvedScheme,
  type ChipSize,
  type ChipTone,
  type ChipVariant,
} from '@skkuverse/sds';
import { Group } from './Group';
import { Row } from './Row';
import { noop } from './catalog.constants';
import { useStaticPress } from './useStaticPress';
import { CHIP_LABEL_TEXT, chipCatalog, chipFeedback, chipSurface, txtSlot } from './catalog.rules';

const { variant: VARIANTS, tone: TONES, size: SIZES } = chipVariantMap;

const RADIO_ITEMS = ['all', 'hssc', 'nsc'] as const;

export function ChipStates() {
  return (
    <>
      {VARIANTS.map((variant) => (
        <Group key={variant} label={`variant="${variant}" — size × checked (Chip.Toggle)`}>
          <Row label="rest (any tone)">
            {SIZES.map((size) => (
              <Chip.Toggle key={size} variant={variant} size={size} checked={false}>
                <Chip.Label>{size}</Chip.Label>
              </Chip.Toggle>
            ))}
          </Row>
          {TONES.map((tone) => (
            <Row key={tone} label={`checked · tone="${tone}"`}>
              {SIZES.map((size) => (
                <Chip.Toggle key={size} variant={variant} tone={tone} size={size} checked>
                  <Chip.Label>{size}</Chip.Label>
                </Chip.Toggle>
              ))}
            </Row>
          ))}
        </Group>
      ))}

      {VARIANTS.map((variant) => (
        <Group key={variant} label={`variant="${variant}" — rest · pressed · disabled (size="medium")`}>
          <Row label="off">
            <Chip.Toggle variant={variant} checked={false}>
              <Chip.Label>Rest</Chip.Label>
            </Chip.Toggle>
            <StaticPressedChip variant={variant} tone="neutral" selected={false} label="Pressed" />
            <Chip.Toggle variant={variant} checked={false} disabled>
              <Chip.Label>Disabled</Chip.Label>
            </Chip.Toggle>
          </Row>
          {TONES.map((tone) => (
            <Row key={tone} label={`checked · tone="${tone}" (a checked chip only shrinks)`}>
              <Chip.Toggle variant={variant} tone={tone} checked>
                <Chip.Label>Checked</Chip.Label>
              </Chip.Toggle>
              <StaticPressedChip variant={variant} tone={tone} selected label="Pressed" />
              <Chip.Toggle variant={variant} tone={tone} checked disabled>
                <Chip.Label>Disabled</Chip.Label>
              </Chip.Toggle>
            </Row>
          ))}
        </Group>
      ))}

      <Group label="Chip.Button — rest · pressed · disabled, then icons per size">
        {VARIANTS.map((variant) => (
          <Row key={variant} label={`variant="${variant}"`}>
            <Chip.Button variant={variant} onPress={noop}>
              <Chip.Label>Button</Chip.Label>
            </Chip.Button>
            <StaticPressedChip variant={variant} tone="neutral" selected={false} label="Pressed" />
            <Chip.Button variant={variant} disabled onPress={noop}>
              <Chip.Label>Disabled</Chip.Label>
            </Chip.Button>
          </Row>
        ))}
        {VARIANTS.map((variant) => (
          <Row key={variant} label={`variant="${variant}" — PrefixIcon · Label · SuffixIcon`}>
            {SIZES.map((size) => (
              <Chip.Button key={size} variant={variant} size={size} onPress={noop}>
                <Chip.PrefixIcon>
                  <LinkSimpleIcon weight="bold" />
                </Chip.PrefixIcon>
                <Chip.Label>{size}</Chip.Label>
                <Chip.SuffixIcon>
                  <CaretDownIcon weight="bold" />
                </Chip.SuffixIcon>
              </Chip.Button>
            ))}
          </Row>
        ))}
      </Group>

      <Group label="Chip.RadioRoot / RadioItem — interactive, one group per variant × tone">
        {VARIANTS.flatMap((variant) =>
          TONES.map((tone) => (
            <Row key={`${variant}-${tone}`} label={`variant="${variant}" tone="${tone}"`}>
              <Chip.RadioRoot defaultValue="all" style={rowStyle}>
                {RADIO_ITEMS.map((value) => (
                  <Chip.RadioItem key={value} value={value} variant={variant} tone={tone}>
                    <Chip.Label>{value}</Chip.Label>
                  </Chip.RadioItem>
                ))}
              </Chip.RadioRoot>
            </Row>
          )),
        )}
        <Row label="RadioRoot disabled">
          <Chip.RadioRoot defaultValue="hssc" disabled style={rowStyle}>
            {RADIO_ITEMS.map((value) => (
              <Chip.RadioItem key={value} value={value} variant="outlineWeak" tone="brand">
                <Chip.Label>{value}</Chip.Label>
              </Chip.RadioItem>
            ))}
          </Chip.RadioRoot>
        </Row>
      </Group>

      <Group label="Interactive — Chip.Toggle (uncontrolled), press to toggle">
        <Row>
          {VARIANTS.flatMap((variant) =>
            TONES.map((tone) => (
              <Chip.Toggle key={`${variant}-${tone}`} variant={variant} tone={tone}>
                <Chip.Label>{`${variant === 'solid' ? 'solid' : 'outline'} ${tone}`}</Chip.Label>
              </Chip.Toggle>
            )),
          )}
        </Row>
      </Group>
    </>
  );
}

const rowStyle = { flexDirection: 'row', flexWrap: 'wrap', gap: SdsSpacing.x2 } as const;

function StaticPressedChip({
  variant,
  tone,
  size = 'medium',
  selected,
  label,
}: {
  variant: ChipVariant;
  tone: ChipTone;
  size?: ChipSize;
  selected: boolean;
  label: string;
}) {
  const scheme = useResolvedScheme();
  const styles = chipCatalog.resolve(scheme, { variant, tone, size, selected, disabled: false });
  const press = useStaticPress({
    bg: chipSurface(variant, tone, selected),
    feedback: chipFeedback(selected),
  });
  return (
    <View
      onLayout={press.onLayout}
      style={[styles.root, press.surface !== undefined && { backgroundColor: press.surface }, press.scaleStyle]}
    >
      <Txt
        typography={CHIP_LABEL_TEXT.typography}
        fontWeight={CHIP_LABEL_TEXT.fontWeight}
        numberOfLines={1}
        style={txtSlot(styles.label)}
      >
        {label}
      </Txt>
    </View>
  );
}
