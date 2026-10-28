import React, { type ReactNode } from 'react';
import { View } from 'react-native';
import { Caption } from './Caption';
import { useStyles } from './Section';

export function Cell({ caption, children }: { caption: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.cell}>
      {children}
      <Caption>{caption}</Caption>
    </View>
  );
}
