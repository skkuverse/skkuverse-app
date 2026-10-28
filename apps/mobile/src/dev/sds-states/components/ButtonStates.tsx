import React from 'react';
import { View } from 'react-native';
import {
  Button,
  ColorSchemeProvider,
  Txt,
  buttonVariantMap,
  useResolvedScheme,
  type ButtonDisplay,
  type ButtonSize,
  type ButtonTone,
  type ButtonVariant,
} from '@skkuverse/sds';
import { Caption } from './Caption';
import { Group } from './Group';
import { Row } from './Row';
import { useStyles } from './Section';
import { DARK_BACKDROP_NAME, noop } from './catalog.constants';
import { useStaticPress } from './useStaticPress';
import { BUTTON_SIZE_TYPOGRAPHY, buttonCatalog, buttonSurfaceToken, txtSlot } from './catalog.rules';

const { tone: TONES, variant: VARIANTS, size: SIZES, display: DISPLAYS } = buttonVariantMap;

export function ButtonStates() {
  const styles = useStyles();
  return (
    <>
      {VARIANTS.map((variant) => (
        <Group key={variant} label={`variant="${variant}" — tone × size`}>
          {TONES.map((tone) => (
            <Row key={tone} label={`tone="${tone}"`}>
              {SIZES.map((size) => (
                <Button key={size} tone={tone} variant={variant} size={size} onPress={noop}>
                  {size}
                </Button>
              ))}
            </Row>
          ))}
        </Group>
      ))}

      <Group label='States — rest · pressed · disabled · loading (size="small")'>
        {VARIANTS.flatMap((variant) =>
          TONES.map((tone) => (
            <Row key={`${tone}-${variant}`} label={`tone="${tone}" variant="${variant}"`}>
              <Button tone={tone} variant={variant} size="small" onPress={noop}>
                Rest
              </Button>
              <StaticPressedButton tone={tone} variant={variant} size="small" label="Pressed" />
              <Button tone={tone} variant={variant} size="small" disabled onPress={noop}>
                Disabled
              </Button>
              <Button tone={tone} variant={variant} size="small" loading onPress={noop}>
                Loading
              </Button>
            </Row>
          )),
        )}
      </Group>

      <Group label='display — inline · block · full (tone="brand", size="medium")'>
        {DISPLAYS.map((display) => (
          <View key={display} style={styles.rowBlock}>
            <Caption>{`display="${display}" — rest, then pressed`}</Caption>
            <Button size="medium" display={display} onPress={noop}>
              {display}
            </Button>
            <StaticPressedButton tone="brand" variant="solid" size="medium" display={display} label={display} />
          </View>
        ))}
      </Group>

      <Group label="Interactive — press and hold">
        <Row>
          {TONES.map((tone) => (
            <Button key={tone} tone={tone} size="small" onPress={noop}>
              {tone}
            </Button>
          ))}
          <Button tone="neutral" variant="weak" size="small" onPress={noop}>
            weak
          </Button>
        </Row>
      </Group>

      <Group label={`On a dark ground — tone="neutral" under a dark scheme (on ${DARK_BACKDROP_NAME})`}>
        <ColorSchemeProvider colorMode="dark-only">
          <Row style={styles.darkBackdrop}>
            {VARIANTS.map((variant) => (
              <Button key={variant} tone="neutral" variant={variant} size="small" onPress={noop}>
                {variant}
              </Button>
            ))}
            <Button tone="neutral" variant="weak" size="small" loading onPress={noop}>
              Loading
            </Button>
          </Row>
        </ColorSchemeProvider>
      </Group>
    </>
  );
}

function StaticPressedButton({
  tone,
  variant,
  size,
  display = 'inline',
  label,
}: {
  tone: ButtonTone;
  variant: ButtonVariant;
  size: ButtonSize;
  display?: ButtonDisplay;
  label: string;
}) {
  const scheme = useResolvedScheme();
  const styles = buttonCatalog.resolve(scheme, { tone, variant, size, display, disabled: false });
  const press = useStaticPress({ bg: buttonSurfaceToken(tone, variant) });
  const contentScale = display === 'full';

  return (
    <View style={styles.root} onLayout={press.onLayout}>
      <View style={[styles.container, !contentScale && press.scaleStyle]}>
        <View
          style={[styles.surface, press.surface !== undefined && { backgroundColor: press.surface }]}
        />
        <View style={[styles.content, contentScale && press.scaleStyle]}>
          <Txt typography={BUTTON_SIZE_TYPOGRAPHY[size]} fontWeight="semiBold" style={txtSlot(styles.label)}>
            {label}
          </Txt>
        </View>
      </View>
    </View>
  );
}
