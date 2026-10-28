import React, { forwardRef, type ReactNode } from 'react';
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { createRecipe } from '../../core/createRecipe';
import { Button } from '../button';
import { Pressable } from '../pressable';
import { pressableSlot } from '../pressable/pressableSlot';
import { Txt } from '../txt';
import { txtSlot } from '../txt/txtSlot';
import {
  RESULT_SECTION_PRIMARY,
  RESULT_SECTION_TEXT,
  resultSectionRecipe,
  type ResultSectionActionTone,
  type ResultSectionSize,
} from './resultSectionRecipe';

const useResultSectionRecipe = createRecipe(resultSectionRecipe);

export const resultSectionVariantMap = useResultSectionRecipe.variantMap;

export interface ResultSectionActionProps {
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
}

export interface ResultSectionPrimaryActionProps extends ResultSectionActionProps {
  tone?: ResultSectionActionTone;
}

export interface ResultSectionProps extends Omit<ViewProps, 'children' | 'style'> {
  size?: ResultSectionSize;
  asset?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  primaryActionProps?: ResultSectionPrimaryActionProps;
  secondaryActionProps?: Omit<ResultSectionActionProps, 'loading'>;
  style?: StyleProp<ViewStyle>;
}

export const ResultSection = forwardRef<View, ResultSectionProps>(function ResultSection(
  {
    size = 'large',
    asset,
    title,
    description,
    primaryActionProps,
    secondaryActionProps,
    style,
    ...rest
  },
  ref,
) {
  const styles = useResultSectionRecipe({
    size,
    secondaryDisabled: secondaryActionProps?.disabled ?? false,
  });
  const titleText = RESULT_SECTION_TEXT.title[size];
  const descriptionText = RESULT_SECTION_TEXT.description[size];
  const secondaryText = RESULT_SECTION_TEXT.secondaryAction;

  return (
    <View ref={ref} style={[styles.root, style]} {...rest}>
      {asset != null ? <View style={styles.asset}>{asset}</View> : null}
      <View style={styles.text}>
        {title != null ? (
          <Txt typography={titleText.typography} fontWeight={titleText.fontWeight} style={txtSlot(styles.title)}>
            {title}
          </Txt>
        ) : null}
        {description != null ? (
          <Txt
            typography={descriptionText.typography}
            fontWeight={descriptionText.fontWeight}
            style={txtSlot(styles.description)}
          >
            {description}
          </Txt>
        ) : null}
      </View>
      {primaryActionProps || secondaryActionProps ? (
        <View style={styles.actions}>
          {primaryActionProps ? (
            <Button
              {...RESULT_SECTION_PRIMARY[primaryActionProps.tone ?? 'neutral']}
              size="small"
              onPress={primaryActionProps.onPress}
              disabled={primaryActionProps.disabled}
              loading={primaryActionProps.loading}
              accessibilityLabel={primaryActionProps.accessibilityLabel}
            >
              {primaryActionProps.children}
            </Button>
          ) : null}
          {secondaryActionProps ? (
            <Pressable
              bg="transparent"
              style={pressableSlot(styles.secondaryAction)}
              onPress={secondaryActionProps.onPress}
              disabled={secondaryActionProps.disabled}
              accessibilityLabel={secondaryActionProps.accessibilityLabel}
            >
              <Txt
                typography={secondaryText.typography}
                fontWeight={secondaryText.fontWeight}
                style={txtSlot(styles.secondaryActionLabel)}
              >
                {secondaryActionProps.children}
              </Txt>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});
