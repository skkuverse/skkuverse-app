import React, { type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Caption } from './Caption';
import { useStyles } from './Section';

export function Row({
  label,
  style,
  children,
}: {
  label?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.rowBlock}>
      {label ? <Caption>{label}</Caption> : null}
      <View style={[styles.row, style]}>{children}</View>
    </View>
  );
}
