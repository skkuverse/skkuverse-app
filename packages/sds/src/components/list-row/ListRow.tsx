import React, { forwardRef, type ReactNode } from 'react';
import { View, type AccessibilityProps, type StyleProp, type ViewStyle } from 'react-native';
import { CaretRightIcon } from 'phosphor-react-native';
import { createRecipe } from '../../core/createRecipe';
import { useSemanticColors } from '../../core/theme';
import { RowPressable } from '../pressable/RowPressable';
import { Txt, type TxtProps } from '../txt';
import {
  LIST_ROW_ARROW,
  LIST_ROW_LEFT_TEXT,
  LIST_ROW_TEXTS,
  listRowRecipe,
  listRowVerticalPadding,
  type ListRowTextStyle,
} from './listRowRecipe';

export interface ListRowRef {
  blink: (duration?: number) => void;
  shine: (playCount?: number) => void;
}

export interface ListRowProps extends AccessibilityProps {
  left?: ReactNode;
  contents?: ReactNode;
  right?: ReactNode;
  withArrow?: boolean;
  leftAlignment?: 'top' | 'center';
  rightAlignment?: 'top' | 'center';
  horizontalPadding?: 0;
  verticalPadding?: 'xsmall' | 8 | 'small' | 16 | 'medium' | 24 | 'large' | 32;
  containerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  disabled?: boolean;
}

const useListRowRecipe = createRecipe(listRowRecipe);

export const listRowVariantMap = useListRowRecipe.variantMap;

function RightArrow({ style }: { style: StyleProp<ViewStyle> }) {
  const color = useSemanticColors();
  return (
    <View style={style}>
      <CaretRightIcon size={LIST_ROW_ARROW.size} color={color.fg[LIST_ROW_ARROW.color]} />
    </View>
  );
}

const ListRowInner = forwardRef<ListRowRef, ListRowProps>(function ListRow(
  {
    left,
    contents,
    right,
    withArrow = false,
    leftAlignment = 'center',
    rightAlignment = 'center',
    horizontalPadding,
    verticalPadding,
    containerStyle,
    style,
    onPress,
    disabled = false,
    ...a11yProps
  },
  ref,
) {
  const styles = useListRowRecipe({
    verticalPadding: listRowVerticalPadding(verticalPadding),
    horizontalPadding: horizontalPadding === 0 ? 'none' : 'default',
    leftAlignment,
    rightAlignment,
    faded: disabled,
  });

  const content = (
    <View style={[styles.container, containerStyle]}>
      {left != null && <View style={styles.left}>{left}</View>}
      {contents != null && <View style={styles.contents}>{contents}</View>}
      {(right != null || withArrow) && (
        <View style={styles.right}>
          {right}
          {withArrow && <RightArrow style={styles.arrow} />}
        </View>
      )}
    </View>
  );

  if (onPress && !disabled) {
    return (
      <RowPressable onPress={onPress} style={[styles.root, style]} {...a11yProps}>
        {content}
      </RowPressable>
    );
  }

  return (
    <View style={[styles.root, style]} {...a11yProps}>
      {content}
    </View>
  );
});

interface TextsBaseProps {
  top: ReactNode;
  topProps?: Omit<TxtProps, 'children'>;
}

interface Texts2RowBaseProps extends TextsBaseProps {
  bottom: ReactNode;
  bottomProps?: Omit<TxtProps, 'children'>;
}

interface Texts3RowBaseProps extends Texts2RowBaseProps {
  middle: ReactNode;
  middleProps?: Omit<TxtProps, 'children'>;
}

type ListRowTextsProps =
  | ({ layout: '1RowTypeA' } & TextsBaseProps)
  | ({ layout: '1RowTypeB' } & TextsBaseProps)
  | ({ layout: '1RowTypeC' } & TextsBaseProps)
  | ({ layout: '2RowTypeA' } & Texts2RowBaseProps)
  | ({ layout: '2RowTypeB' } & Texts2RowBaseProps)
  | ({ layout: '2RowTypeC' } & Texts2RowBaseProps)
  | ({ layout: '2RowTypeD' } & Texts2RowBaseProps)
  | ({ layout: '2RowTypeE' } & Texts2RowBaseProps)
  | ({ layout: '2RowTypeF' } & Texts2RowBaseProps)
  | ({ layout: '3RowTypeA' } & Texts3RowBaseProps)
  | ({ layout: '3RowTypeB' } & Texts3RowBaseProps)
  | ({ layout: '3RowTypeC' } & Texts3RowBaseProps);

function TextSlot({
  content,
  config,
  overrideProps,
}: {
  content: ReactNode;
  config: ListRowTextStyle;
  overrideProps?: Omit<TxtProps, 'children'>;
}) {
  if (content == null) return null;
  if (typeof content === 'string' || typeof content === 'number') {
    return (
      <Txt
        typography={config.typography}
        fontWeight={config.fontWeight}
        color={config.color}
        {...overrideProps}
      >
        {String(content)}
      </Txt>
    );
  }
  return <>{content}</>;
}

function ListRowTexts(props: ListRowTextsProps) {
  const styles = useListRowRecipe();
  const config = LIST_ROW_TEXTS[props.layout] ?? LIST_ROW_TEXTS['1RowTypeA'];

  // QUIRK(yoga): a `flexBasis: 0` child stretches to its parent's at-most height, so `flex: 1` here pinned a one-line title
  // to the top whenever `left` or `right` was taller; the width already comes from the slot's `alignItems: 'stretch'`.
  return (
    <View>
      <TextSlot content={props.top} config={config.top} overrideProps={props.topProps} />
      {'middle' in props && config.middle && (
        <View style={styles.line}>
          <TextSlot
            content={(props as Texts3RowBaseProps).middle}
            config={config.middle}
            overrideProps={(props as Texts3RowBaseProps).middleProps}
          />
        </View>
      )}
      {'bottom' in props && config.bottom && (
        <View style={styles.line}>
          <TextSlot
            content={(props as Texts2RowBaseProps).bottom}
            config={config.bottom}
            overrideProps={(props as Texts2RowBaseProps).bottomProps}
          />
        </View>
      )}
    </View>
  );
}

function ListRowLeftText({
  children,
  style,
  ...props
}: TxtProps & { children: string }) {
  return (
    <Txt
      typography={LIST_ROW_LEFT_TEXT.typography}
      fontWeight={LIST_ROW_LEFT_TEXT.fontWeight}
      color={LIST_ROW_LEFT_TEXT.color}
      style={[{ width: LIST_ROW_LEFT_TEXT.width }, style]}
      {...props}
    >
      {children}
    </Txt>
  );
}

export const ListRow = Object.assign(ListRowInner, {
  Texts: ListRowTexts,
  LeftText: ListRowLeftText,
});

export type { ListRowTextsProps };
