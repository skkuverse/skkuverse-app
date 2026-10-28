import React, { type ReactNode } from 'react';
import { View } from 'react-native';
import { Txt } from '@skkuverse/sds';
import { useStyles } from './Section';

export function Group({ label, children }: { label: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.group}>
      <Txt typography="t4" fontWeight="semiBold" style={styles.groupLabel}>
        {label}
      </Txt>
      {children}
    </View>
  );
}
