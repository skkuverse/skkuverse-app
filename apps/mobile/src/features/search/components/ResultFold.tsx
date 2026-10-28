import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { CaretDownIcon, CaretRightIcon } from 'phosphor-react-native';
import { SdsSpacing } from '@skkuverse/shared';
import { ListHeader, Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';

interface ResultFoldProps {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  divided?: boolean;
  children: ReactNode;
}

export function ResultFold({ title, count, expanded, onToggle, divided = false, children }: ResultFoldProps) {
  const color = useSemanticColors();
  const styles = useStyles();

  return (
    <>
      {divided && <View style={styles.divider} />}
      <ListHeader
        title={
          <ListHeader.TitleParagraph typography="t7" fontWeight="bold">
            {title}
          </ListHeader.TitleParagraph>
        }
        right={
          <View style={styles.right}>
            <Txt typography="t3" fontWeight="regular" color="placeholder">
              {count}
            </Txt>
            {expanded ? (
              <CaretDownIcon size={16} color={color.fg.placeholder} />
            ) : (
              <CaretRightIcon size={16} color={color.fg.placeholder} />
            )}
          </View>
        }
        onPress={onToggle}
      />
      {expanded && (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(100)}
        >
          {children}
        </Animated.View>
      )}
    </>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x1,
  },
  divider: {
    height: SdsSpacing.x2,
    backgroundColor: color.bg.neutralMuted,
  },
}));
