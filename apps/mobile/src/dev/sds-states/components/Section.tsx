import React, { type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { SdsPalette, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { Txt, createThemedStyles } from '@skkuverse/sds';

// WHY: read from the palette, not a role, because a role would lighten in the dark scheme.
// eslint-disable-next-line sds/no-static-theme -- the backdrop must stay dark in both schemes, which no role does
const DARK_BACKDROP = SdsPalette.pine[1000].light;

export function Section({
  title,
  note,
  onLayout,
  children,
}: {
  title: string;
  note?: string;
  onLayout?: (event: LayoutChangeEvent) => void;
  children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.section} onLayout={onLayout}>
      <View style={styles.sectionHead}>
        <Txt typography="t10" fontWeight="bold" style={styles.title}>
          {title}
        </Txt>
        {note ? (
          <Txt typography="t3" style={styles.note}>
            {note}
          </Txt>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export const useStyles = createThemedStyles(({ color }) => ({
  section: {
    paddingHorizontal: SdsSpacing.x4,
    paddingTop: SdsSpacing.x8,
    paddingBottom: SdsSpacing.x6,
    gap: SdsSpacing.x6,
    borderTopWidth: 1,
    borderTopColor: color.stroke.neutralMuted,
  },
  sectionHead: {
    gap: SdsSpacing.x1,
  },
  title: {
    color: color.fg.neutral,
  },
  note: {
    color: color.fg.neutralMuted,
  },
  group: {
    gap: SdsSpacing.x3,
  },
  groupLabel: {
    color: color.fg.neutral,
  },
  rowBlock: {
    gap: SdsSpacing.x1_5,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: SdsSpacing.x2,
  },
  cell: {
    alignItems: 'center',
    gap: SdsSpacing.x1,
  },
  darkBackdrop: {
    backgroundColor: DARK_BACKDROP,
    padding: SdsSpacing.x3,
    borderRadius: SdsRadius.r3,
  },
  frame: {
    borderWidth: 1,
    borderColor: color.stroke.neutralMuted,
    borderRadius: SdsRadius.r3,
    overflow: 'hidden',
  },
}));
