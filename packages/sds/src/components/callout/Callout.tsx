import React, { forwardRef, useCallback, type ReactNode } from 'react';
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { CaretRightIcon, XIcon } from 'phosphor-react-native';
import { createRecipe } from '../../core/createRecipe';
import { useControllableState } from '../../utils/useControllableState';
import { IconSlot } from '../icon-slot/IconSlot';
import { Pressable, type PressableProps, type PressableStyle } from '../pressable';
import { pressableSlot } from '../pressable/pressableSlot';
import { Txt } from '../txt';
import { txtSlot } from '../txt/txtSlot';
import { CALLOUT_ROLES, CALLOUT_TEXT, calloutRecipe, type CalloutTone } from './calloutRecipe';

const useCalloutRecipe = createRecipe(calloutRecipe);

export const calloutVariantMap = useCalloutRecipe.variantMap;

type CalloutStyles = ReturnType<typeof useCalloutRecipe>;

const RUN_SEPARATOR = '  ';

export interface CalloutLinkProps {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel?: string;
}

interface CalloutContentProps {
  tone?: CalloutTone;
  prefixIcon?: ReactNode;
  title?: ReactNode;
  description: ReactNode;
}

export interface CalloutProps extends CalloutContentProps, Omit<ViewProps, 'children' | 'style'> {
  linkProps?: CalloutLinkProps;
  style?: StyleProp<ViewStyle>;
}

/** SEE: docs/reference/design-usage.md ("Callout"): no link, since the whole callout is the target (CALLOUT-03, after SEED's spec). */
export interface ActionableCalloutProps
  extends CalloutContentProps,
    Omit<
      PressableProps,
      'bg' | 'feedback' | 'scaleScope' | 'contentStyle' | 'loading' | 'children' | 'style' | 'onPress'
    > {
  onPress: NonNullable<PressableProps['onPress']>;
  style?: StyleProp<PressableStyle>;
}

export interface DismissibleCalloutProps extends CalloutProps {
  open?: boolean;
  defaultOpen?: boolean;
  onDismiss?: () => void;
  dismissLabel: string;
}

function CalloutParagraph({
  styles,
  title,
  description,
  link,
}: {
  styles: CalloutStyles;
  title?: ReactNode;
  description: ReactNode;
  link?: CalloutLinkProps;
}) {
  return (
    <Txt typography={CALLOUT_TEXT.description.typography} style={txtSlot(styles.content)}>
      {title != null ? (
        <Txt
          typography={CALLOUT_TEXT.title.typography}
          fontWeight={CALLOUT_TEXT.title.fontWeight}
          style={txtSlot(styles.title)}
        >
          {title}
          {RUN_SEPARATOR}
        </Txt>
      ) : null}
      <Txt
        typography={CALLOUT_TEXT.description.typography}
        fontWeight={CALLOUT_TEXT.description.fontWeight}
        style={txtSlot(styles.description)}
      >
        {description}
      </Txt>
      {link ? (
        <>
          {RUN_SEPARATOR}
          <Txt
            typography={CALLOUT_TEXT.link.typography}
            fontWeight={CALLOUT_TEXT.link.fontWeight}
            style={txtSlot(styles.link)}
            accessibilityRole="link"
            accessibilityLabel={link.accessibilityLabel}
            onPress={link.onPress}
            suppressHighlighting
          >
            {link.children}
          </Txt>
        </>
      ) : null}
    </Txt>
  );
}

export const Callout = forwardRef<View, CalloutProps>(function Callout(
  { tone = 'neutral', prefixIcon, title, description, linkProps, style, ...rest },
  ref,
) {
  const styles = useCalloutRecipe({ tone });
  return (
    <View ref={ref} style={[styles.root, style]} {...rest}>
      {prefixIcon != null ? (
        <IconSlot box={styles.prefixIcon} color={styles.content.color}>
          {prefixIcon}
        </IconSlot>
      ) : null}
      <CalloutParagraph styles={styles} title={title} description={description} link={linkProps} />
    </View>
  );
});

export const ActionableCallout = forwardRef<View, ActionableCalloutProps>(function ActionableCallout(
  { tone = 'neutral', prefixIcon, title, description, style, ...rest },
  ref,
) {
  const styles = useCalloutRecipe({ tone });
  return (
    <Pressable ref={ref} bg={CALLOUT_ROLES[tone].surface} style={[pressableSlot(styles.root), style]} {...rest}>
      {prefixIcon != null ? (
        <IconSlot box={styles.prefixIcon} color={styles.content.color}>
          {prefixIcon}
        </IconSlot>
      ) : null}
      <CalloutParagraph styles={styles} title={title} description={description} />
      <IconSlot box={styles.suffixIcon} color={styles.content.color}>
        <CaretRightIcon />
      </IconSlot>
    </Pressable>
  );
});

export const DismissibleCallout = forwardRef<View, DismissibleCalloutProps>(function DismissibleCallout(
  {
    tone = 'neutral',
    prefixIcon,
    title,
    description,
    linkProps,
    open: openProp,
    defaultOpen = true,
    onDismiss,
    dismissLabel,
    style,
    ...rest
  },
  ref,
) {
  const styles = useCalloutRecipe({ tone });
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) onDismiss?.();
    },
    [onDismiss],
  );
  const [open, setOpen] = useControllableState({
    value: openProp,
    defaultValue: defaultOpen,
    onChange: handleOpenChange,
  });

  if (!open) return null;

  return (
    <View ref={ref} style={[styles.root, style]} {...rest}>
      {prefixIcon != null ? (
        <IconSlot box={styles.prefixIcon} color={styles.content.color}>
          {prefixIcon}
        </IconSlot>
      ) : null}
      <CalloutParagraph styles={styles} title={title} description={description} link={linkProps} />
      {/* WHY: 40pt as SEED draws it; the slop brings the target to 44 without leaving the callout. */}
      <Pressable
        bg="transparent"
        style={pressableSlot(styles.closeButton)}
        hitSlop={2}
        accessibilityLabel={dismissLabel}
        onPress={() => setOpen(false)}
      >
        <IconSlot box={styles.suffixIcon} color={styles.content.color}>
          <XIcon />
        </IconSlot>
      </Pressable>
    </View>
  );
});
