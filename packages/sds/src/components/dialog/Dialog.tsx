import React, { useCallback, useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Pressable } from '../pressable';
import { GlassView } from 'expo-glass-effect';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SdsDuration, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { createThemedStyles, useSemanticColors } from '../../core/theme';
import { springConfig } from '../../foundation/easings';
import { Txt } from '../txt';
import { Button } from '../button';
import { GLASS_AVAILABLE } from '../glass/Glass';
import { closesOnDimmerTap } from './dimmer';

function CardGlass({ glass }: { glass: boolean }) {
  const color = useSemanticColors();
  if (!glass || !GLASS_AVAILABLE) return null;
  return (
    <GlassView style={StyleSheet.absoluteFill} glassEffectStyle="regular" tintColor={color.bg.glassTint} />
  );
}

export interface AlertDialogProps {
  open: boolean;
  title?: ReactNode;
  description?: string;
  content?: ReactNode;
  buttonText?: string;
  onButtonPress?: () => void;
  onClose: () => void;
  onExited?: () => void;
  onEntered?: () => void;
  closeOnDimmerClick?: boolean;
  glass?: boolean;
}

function AlertDialog({
  open,
  title,
  description,
  content,
  buttonText = '확인',
  onButtonPress,
  onClose,
  onExited,
  onEntered,
  closeOnDimmerClick,
  glass = false,
}: AlertDialogProps) {
  const styles = useStyles();
  const dimmer = useSharedValue(0);
  const cardScale = useSharedValue(0.9);
  const cardOpacity = useSharedValue(0);
  const mounted = useSharedValue(false);

  useEffect(() => {
    if (open) {
      mounted.value = true;
      dimmer.value = withTiming(1, { duration: SdsDuration.normal });
      cardOpacity.value = withTiming(1, { duration: SdsDuration.normal });
      cardScale.value = withSpring(1, springConfig('quick'), (finished) => {
        if (finished && onEntered) runOnJS(onEntered)();
      });
    } else if (mounted.value) {
      dimmer.value = withTiming(0, { duration: SdsDuration.normal });
      cardScale.value = withTiming(0.9, { duration: SdsDuration.normal });
      cardOpacity.value = withTiming(0, { duration: SdsDuration.normal }, (finished) => {
        if (finished) {
          mounted.value = false;
          if (onExited) runOnJS(onExited)();
        }
      });
    }
  }, [open, dimmer, cardScale, cardOpacity, mounted, onExited, onEntered]);

  const glassCard = glass && GLASS_AVAILABLE;

  const overlayStyle = useAnimatedStyle(() => ({
    display: mounted.value ? 'flex' : 'none',
  }));

  const dimmerStyle = useAnimatedStyle(() => ({
    opacity: dimmer.value,
  }));

  // QUIRK(ios): a GlassView that starts under opacity 0 renders nothing even after the fade ends, so a glass card only scales in and the fade lives on the dimmer.
  const cardStyle = useAnimatedStyle(() => ({
    opacity: glassCard ? 1 : cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const handleButton = useCallback(() => {
    onButtonPress?.();
    onClose();
  }, [onButtonPress, onClose]);

  const handleDimmerPress = useCallback(() => {
    if (closesOnDimmerTap('alert', closeOnDimmerClick)) onClose();
  }, [closeOnDimmerClick, onClose]);

  const renderTitle = () => {
    if (title == null) return null;
    if (typeof title === 'string') {
      return (
        <Txt typography="t9" fontWeight="bold" style={styles.title}>
          {title}
        </Txt>
      );
    }
    return <View style={styles.title}>{title}</View>;
  };

  return (
    <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={[styles.dimmer, dimmerStyle]}>
        <Pressable feedback="none" accessibilityRole="none" style={StyleSheet.absoluteFill} onPress={handleDimmerPress} />
      </Animated.View>
      <Animated.View style={[styles.card, glassCard && styles.cardGlass, cardStyle]}>
        <CardGlass glass={glass} />
        {renderTitle()}
        {description != null && (
          <Txt typography="t5" color="neutralSubtle" style={styles.description}>
            {description}
          </Txt>
        )}
        {content}
        <View style={styles.buttonRow}>
          <Button size="medium" display="block" onPress={handleButton}>
            {buttonText}
          </Button>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  title?: ReactNode;
  description?: string;
  content?: ReactNode;
  leftButton: ReactNode;
  rightButton: ReactNode;
  onClose: () => void;
  onExited?: () => void;
  onEntered?: () => void;
  /** WHY: a confirm asks for a choice, so it closes only through its buttons (DIALOG-03); pass `true` only for a choice a tap outside may decline. */
  closeOnDimmerClick?: boolean;
  glass?: boolean;
}

function ConfirmDialog({
  open,
  title,
  description,
  content,
  leftButton,
  rightButton,
  onClose,
  onExited,
  onEntered,
  closeOnDimmerClick,
  glass = false,
}: ConfirmDialogProps) {
  const styles = useStyles();
  const dimmer = useSharedValue(0);
  const cardScale = useSharedValue(0.9);
  const cardOpacity = useSharedValue(0);
  const mounted = useSharedValue(false);

  useEffect(() => {
    if (open) {
      mounted.value = true;
      dimmer.value = withTiming(1, { duration: SdsDuration.normal });
      cardOpacity.value = withTiming(1, { duration: SdsDuration.normal });
      cardScale.value = withSpring(1, springConfig('quick'), (finished) => {
        if (finished && onEntered) runOnJS(onEntered)();
      });
    } else if (mounted.value) {
      dimmer.value = withTiming(0, { duration: SdsDuration.normal });
      cardScale.value = withTiming(0.9, { duration: SdsDuration.normal });
      cardOpacity.value = withTiming(0, { duration: SdsDuration.normal }, (finished) => {
        if (finished) {
          mounted.value = false;
          if (onExited) runOnJS(onExited)();
        }
      });
    }
  }, [open, dimmer, cardScale, cardOpacity, mounted, onExited, onEntered]);

  const glassCard = glass && GLASS_AVAILABLE;

  const overlayStyle = useAnimatedStyle(() => ({
    display: mounted.value ? 'flex' : 'none',
  }));

  const dimmerStyle = useAnimatedStyle(() => ({
    opacity: dimmer.value,
  }));

  // QUIRK(ios): a GlassView that starts under opacity 0 renders nothing even after the fade ends, so a glass card only scales in and the fade lives on the dimmer.
  const cardStyle = useAnimatedStyle(() => ({
    opacity: glassCard ? 1 : cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const handleDimmerPress = useCallback(() => {
    if (closesOnDimmerTap('confirm', closeOnDimmerClick)) onClose();
  }, [closeOnDimmerClick, onClose]);

  const renderTitle = () => {
    if (title == null) return null;
    if (typeof title === 'string') {
      return (
        <Txt typography="t9" fontWeight="bold" style={styles.title}>
          {title}
        </Txt>
      );
    }
    return <View style={styles.title}>{title}</View>;
  };

  return (
    <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={[styles.dimmer, dimmerStyle]}>
        <Pressable feedback="none" accessibilityRole="none" style={StyleSheet.absoluteFill} onPress={handleDimmerPress} />
      </Animated.View>
      <Animated.View style={[styles.card, glassCard && styles.cardGlass, cardStyle]}>
        <CardGlass glass={glass} />
        {renderTitle()}
        {description != null && (
          <Txt typography="t5" color="neutralSubtle" style={styles.description}>
            {description}
          </Txt>
        )}
        {content}
        <View style={styles.confirmButtonRow}>
          <View style={styles.confirmButton}>{leftButton}</View>
          <View style={styles.confirmButton}>{rightButton}</View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

export const Dialog = {
  Alert: AlertDialog,
  Confirm: ConfirmDialog,
};

const useStyles = createThemedStyles(({ color }) => ({
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  dimmer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: color.bg.overlay,
  },
  card: {
    backgroundColor: color.bg.layerFloating,
    borderRadius: SdsRadius.r5,
    paddingTop: SdsSpacing.x7,
    paddingHorizontal: SdsSpacing.x6,
    paddingBottom: SdsSpacing.x5,
    width: '85%',
    maxWidth: 320,
  },
  cardGlass: {
    backgroundColor: color.bg.transparent,
    overflow: 'hidden',
  },
  title: {
    marginBottom: SdsSpacing.x2,
    textAlign: 'center',
  },
  description: {
    marginBottom: SdsSpacing.x5,
    textAlign: 'center',
  },
  buttonRow: {
    marginTop: SdsSpacing.x2,
  },
  confirmButtonRow: {
    flexDirection: 'row',
    gap: SdsSpacing.x2,
    marginTop: SdsSpacing.x2,
  },
  confirmButton: {
    flex: 1,
  },
}));
