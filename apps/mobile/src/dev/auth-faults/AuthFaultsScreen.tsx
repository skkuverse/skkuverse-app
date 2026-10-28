import React, { useReducer } from 'react';
import { ScrollView, View } from 'react-native';
import { SdsSpacing } from '@skkuverse/shared';
import { Chip, Txt, createThemedStyles } from '@skkuverse/sds';
import { AUTH_FAULT_SHAPES, AUTH_FAULT_TARGETS } from './auth-faults.rules';
import { armAuthFault, armedAuthFault } from './auth-faults.service';

const OFF = 'off';

export function AuthFaultsScreen() {
  const styles = useStyles();
  const [, redraw] = useReducer((n: number) => n + 1, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Txt typography="t5" color="neutralSubtle">
        An armed target throws its recorded failure on every call until turned off. Sign out, retry a
        sign-in or background and foreground the app to drive the path.
      </Txt>
      {AUTH_FAULT_TARGETS.map((target) => (
        <View key={target} style={styles.row}>
          <Txt typography="t4" fontWeight="semibold">
            {target}
          </Txt>
          <Chip.RadioRoot
            value={armedAuthFault(target) ?? OFF}
            onValueChange={(value) => {
              armAuthFault(target, AUTH_FAULT_SHAPES.find((shape) => shape === value) ?? null);
              redraw();
            }}
            style={styles.chips}
          >
            <Chip.RadioItem value={OFF}>
              <Chip.Label>{OFF}</Chip.Label>
            </Chip.RadioItem>
            {AUTH_FAULT_SHAPES.map((shape) => (
              <Chip.RadioItem key={shape} value={shape} tone="brand">
                <Chip.Label>{shape}</Chip.Label>
              </Chip.RadioItem>
            ))}
          </Chip.RadioRoot>
        </View>
      ))}
    </ScrollView>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
  content: {
    padding: SdsSpacing.x4,
    gap: SdsSpacing.x6,
  },
  row: {
    gap: SdsSpacing.x2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SdsSpacing.x2,
  },
}));
