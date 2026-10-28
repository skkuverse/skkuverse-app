import React, { useEffect, useRef, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircleIcon, XCircleIcon, WarningCircleIcon, InfoIcon } from 'phosphor-react-native';
import { SdsDuration, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { createThemedStyles, useSemanticColors } from '../../core/theme';
import { springConfig } from '../../foundation/easings';
import { Pressable } from '../pressable';
import { Txt } from '../txt';
import { startToastTimer, toastDisplayMs, type ToastClock, type ToastTimer } from './toastTimer';

const SYSTEM_CLOCK: ToastClock = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface ToastProps {
  open: boolean;
  text: string;
  position?: 'top' | 'bottom';
  icon?: ReactNode;
  button?: ReactNode;
  bottomOffset?: number;
  onClose: () => void;
  onExited?: () => void;
  onEntered?: () => void;
}

function ToastMain({
  open,
  text,
  position = 'bottom',
  icon,
  button,
  bottomOffset,
  onClose,
  onExited,
  onEntered,
}: ToastProps) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const translateY = useSharedValue(position === 'bottom' ? 100 : -100);
  const opacity = useSharedValue(0);
  const mounted = useSharedValue(false);
  const timerRef = useRef<ToastTimer | null>(null);

  useEffect(() => {
    if (open) {
      mounted.value = true;
      opacity.value = withTiming(1, { duration: SdsDuration.normal });
      translateY.value = withSpring(0, springConfig('quick'), (finished) => {
        if (finished && onEntered) runOnJS(onEntered)();
      });

      timerRef.current?.cancel();
      timerRef.current = startToastTimer(toastDisplayMs(SdsDuration, button != null), onClose, SYSTEM_CLOCK);
    } else if (mounted.value) {
      timerRef.current?.cancel();
      opacity.value = withTiming(0, { duration: SdsDuration.normal });
      translateY.value = withTiming(
        position === 'bottom' ? 100 : -100,
        { duration: SdsDuration.normal },
        (finished) => {
          if (finished) {
            mounted.value = false;
            if (onExited) runOnJS(onExited)();
          }
        },
      );
    }

    return () => {
      timerRef.current?.cancel();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- shows or hides when open flips alone; a new callback, button or position waits for the next flip
  }, [open]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
    display: mounted.value ? 'flex' : 'none',
  }));

  const positionStyle =
    position === 'bottom'
      ? { bottom: (bottomOffset ?? SdsSpacing.x5) + insets.bottom }
      : { top: SdsSpacing.x5 + insets.top };

  return (
    <Animated.View
      style={[styles.toastContainer, positionStyle, containerStyle]}
      pointerEvents={open ? 'auto' : 'none'}
    >
      <View
        style={styles.toast}
        onTouchStart={() => timerRef.current?.pause()}
        onTouchEnd={() => timerRef.current?.resume()}
        onTouchCancel={() => timerRef.current?.resume()}
      >
        <View style={styles.toastContent}>
          {icon != null && <View style={styles.iconSlot}>{icon}</View>}
          <Txt typography="t5" fontWeight="medium" color="onToast" style={styles.toastText}>
            {text}
          </Txt>
        </View>
        {button != null && <View style={styles.buttonSlot}>{button}</View>}
      </View>
    </Animated.View>
  );
}

type IconType = 'check' | 'warning' | 'error' | 'info';

interface ToastIconProps {
  type: IconType;
  size?: number;
}

function useIconColor(type: IconType): string {
  const color = useSemanticColors();
  switch (type) {
    case 'check':
      return color.fg.onToastPositive;
    case 'warning':
      return color.fg.onToastWarning;
    case 'error':
      return color.fg.critical;
    case 'info':
      return color.fg.informative;
  }
}

const iconComponents: Record<IconType, typeof CheckCircleIcon> = {
  check: CheckCircleIcon,
  error: XCircleIcon,
  warning: WarningCircleIcon,
  info: InfoIcon,
};

function ToastIcon({ type, size = 20 }: ToastIconProps) {
  const color = useIconColor(type);
  const IconComponent = iconComponents[type];
  return <IconComponent size={size} color={color} weight="fill" />;
}

interface ToastButtonProps {
  text: string;
  onPress: () => void;
}

function ToastButton({ text, onPress }: ToastButtonProps) {
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Txt typography="t3" fontWeight="bold" color="onToastAction">
        {text}
      </Txt>
    </Pressable>
  );
}

export const Toast = Object.assign(ToastMain, {
  Icon: ToastIcon,
  Button: ToastButton,
});

const useStyles = createThemedStyles(({ color }) => ({
  toastContainer: {
    position: 'absolute',
    left: SdsSpacing.x4,
    right: SdsSpacing.x4,
    alignItems: 'center',
    zIndex: 10000,
  },
  toast: {
    backgroundColor: color.bg.toast,
    borderRadius: SdsRadius.r3_5,
    paddingHorizontal: SdsSpacing.x4,
    paddingVertical: SdsSpacing.x3_5,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 480,
  },
  toastContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconSlot: {
    marginRight: SdsSpacing.x2_5,
  },
  toastText: {
    flex: 1,
  },
  buttonSlot: {
    marginLeft: SdsSpacing.x3,
  },
}));
