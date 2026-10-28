import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SdsSpacing, SdsRadius } from '@skkuverse/shared';
import { Badge, Pressable, Txt, createThemedStyles } from '@skkuverse/sds';

export const RESULT_MARK_SIZE = 40;

// WHY: one inset for every row in the results, so they keep one alignment (LIST-03).
export const RESULT_ROW_INSET = {
  paddingHorizontal: SdsSpacing.gutter,
  paddingVertical: SdsSpacing.x3,
};

export function ResultMark({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <View style={styles.mark}>{children}</View>;
}

interface ResultRowProps {
  mark: string;
  title: string;
  subtitle: string;
  code?: string;
  onPress: () => void;
}

export function ResultRow({ mark, title, subtitle, code, onPress }: ResultRowProps) {
  const styles = useStyles();

  return (
    <Pressable
      bg="layerDefault"
      scaleScope="content"
      style={styles.row}
      contentStyle={styles.rowContent}
      onPress={onPress}
    >
      <ResultMark>
        <Txt typography="t3" fontWeight="bold" color="neutralSubtle">
          {mark}
        </Txt>
      </ResultMark>
      <View style={styles.texts}>
        <Txt typography="t5" fontWeight="regular">
          {title}
        </Txt>
        <Txt typography="t3" fontWeight="regular" color="neutralSubtle">
          {subtitle}
        </Txt>
      </View>
      {code !== undefined && (
        <Badge
          size="xsmall"
          color="placeholder"
          backgroundColor="neutralWeak"
        >
          {code}
        </Badge>
      )}
    </Pressable>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  // WHY: a full-width row, so the surface turns and the content shrinks (PRESS-10).
  row: RESULT_ROW_INSET,
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x4,
  },
  mark: {
    width: RESULT_MARK_SIZE,
    height: RESULT_MARK_SIZE,
    borderRadius: SdsRadius.r2_5,
    backgroundColor: color.bg.neutralWeak,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
    gap: SdsSpacing.x0_5,
  },
}));
