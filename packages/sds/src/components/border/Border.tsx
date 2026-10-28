import React, { type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { createRecipe } from '../../core/createRecipe';
import { borderRecipe, type BorderVariant } from './borderRecipe';

export type { BorderVariant };

interface BaseProps {
  variant?: BorderVariant;
  height?: number;
}

type Props = BaseProps & ComponentProps<typeof View>;

const useBorderRecipe = createRecipe(borderRecipe);

export const borderVariantMap = useBorderRecipe.variantMap;

export default function Border({
  variant = 'full',
  style,
  height,
  ...restProps
}: Props) {
  const styles = useBorderRecipe({ variant });
  const spacer = variant === 'height16';

  return (
    <View
      style={[
        !spacer && hairline,
        styles.root,
        spacer && height !== undefined && { height },
        style,
      ]}
      {...restProps}
    />
  );
}

const hairline = { height: StyleSheet.hairlineWidth } as const;

export { Border };
