/** WHY: the bar's grey is not animated: it keeps its contrast against both the glass and the opaque sheet. */

import { useCallback, useState } from 'react';
import { View, type AccessibilityActionEvent } from 'react-native';
import { runOnJS, useAnimatedReaction, type SharedValue } from 'react-native-reanimated';
import { SdsRadius } from '@skkuverse/shared';
import { createThemedStyles } from '../../core/theme';

/** WHY: a page sheet's top spacer subtracts this row (`pageSpacerHeight`). */
export const SHEET_HANDLE_HEIGHT = 22;

export interface SheetHandleA11y {
  label: string;
  detentLabels: readonly (string | undefined)[];
  onStep: (step: 'increment' | 'decrement') => void;
}

const STEP_ACTIONS = [{ name: 'increment' }, { name: 'decrement' }] as const;

export function SheetHandle({ a11y, animatedIndex }: { a11y?: SheetHandleA11y; animatedIndex?: SharedValue<number> }) {
  const styles = useStyles();
  if (a11y && animatedIndex) {
    return <AccessibleHandle a11y={a11y} animatedIndex={animatedIndex} styles={styles} />;
  }
  return (
    <View style={styles.container}>
      <View style={styles.bar} />
    </View>
  );
}

function AccessibleHandle({
  a11y,
  animatedIndex,
  styles,
}: {
  a11y: SheetHandleA11y;
  animatedIndex: SharedValue<number>;
  styles: ReturnType<typeof useStyles>;
}) {
  // WHY: only a change of detent crosses to JS, never a frame of a drag.
  const [index, setIndex] = useState(() => Math.round(animatedIndex.get()));
  useAnimatedReaction(
    () => Math.round(animatedIndex.get()),
    (now, before) => {
      if (now !== before) runOnJS(setIndex)(now);
    },
    [],
  );

  const { onStep } = a11y;
  const handleAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const name = event.nativeEvent.actionName;
      if (name === 'increment' || name === 'decrement') onStep(name);
    },
    [onStep],
  );

  const value = a11y.detentLabels[index];
  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={a11y.label}
      accessibilityValue={value === undefined ? undefined : { text: value }}
      accessibilityActions={STEP_ACTIONS}
      onAccessibilityAction={handleAction}
    >
      <View style={styles.bar} />
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    height: SHEET_HANDLE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    width: 36,
    height: 4,
    borderRadius: SdsRadius.full,
    backgroundColor: color.stroke.neutralWeak,
  },
}));
