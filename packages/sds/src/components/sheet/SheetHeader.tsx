/** WHY: a sibling of the scrollable, never its first row, or the X rides out of reach once the content grows past the sheet. */

import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SdsSpacing } from '@skkuverse/shared';
import { Txt } from '../txt';
import { SheetCloseButton } from './SheetCloseButton';

export interface SheetHeaderProps {
  title?: string;
  /** WHY: omit it only for an inline sheet: a modal that can only be dragged away looks stuck to anyone who does not know the gesture. */
  closeLabel?: string;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function SheetHeader({ title, closeLabel, right, style }: SheetHeaderProps) {
  return (
    <View style={[styles.header, style]}>
      <View style={styles.titleSlot}>
        {title != null && (
          <Txt typography="t9" fontWeight="bold" color="neutral" numberOfLines={1}>
            {title}
          </Txt>
        )}
      </View>
      {right ?? (closeLabel != null ? <SheetCloseButton label={closeLabel} /> : null)}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SdsSpacing.x3,
    paddingVertical: SdsSpacing.x3,
  },
  titleSlot: {
    flexShrink: 1,
  },
});
