import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Keyboard,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabList, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { SdsRadius, SdsSpacing, useT, type TabRoute } from '@skkuverse/shared';
import { Badge, GLASS_AVAILABLE, GlassSurface } from '@skkuverse/sds';
import { useTabBarMinimized } from '@/components/useTabBarMinimize';
import { useMapLayout } from '@/features/map/useMapLayout';
import { NoticesAccessoryBar } from '@/features/notices/NoticesAccessoryBar';
import { tabBarGeometry } from './glass-tabs/geometry.rules';
import { GlassTabBar, GlassTabButton, type GlassTabItem } from './glass-tabs/GlassTabBar';
import { TAB_GLYPHS } from './tab-icons.constants';
import { TAB_ORDER, isTabBarCovered, tabPosition } from './tab-bar.rules';

// EVIDENCE: Liquidum tab_bar.dart:211.
const FLOAT_GAP = 8;

// EVIDENCE: the iOS 26 tab accessory's height, Liquidum tab_bar.dart:210.
const ACCESSORY_HEIGHT = 48;

// WHY: a duplicate press arrives a frame or two after the first; a deliberate second tap comes later than iOS's double-tap interval.
const SAME_TOUCH_MS = 150;

export function useGlassChrome(): boolean {
  const [reduceTransparency, setReduceTransparency] = useState(false);
  useEffect(() => {
    if (!GLASS_AVAILABLE) return;
    let live = true;
    void AccessibilityInfo.isReduceTransparencyEnabled().then((on) => {
      if (live) setReduceTransparency(on);
    });
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return GLASS_AVAILABLE && !reduceTransparency;
}

// QUIRK(android): no `keyboardWillShow`; the Did events are the earliest Android offers.
export function useKeyboardShown(): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setShown(true));
    const hide = Keyboard.addListener(hideEvent, () => setShown(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return shown;
}

type TriggerPress = NonNullable<TabTriggerSlotProps['onPress']>;

// QUIRK(expo-router): the trigger reads the event optionally (`event?.isDefaultPrevented()`); only its type demands a touch.
const pressWithoutTouch = (press: TriggerPress) => press(undefined as unknown as GestureResponderEvent);

interface SharedMapTabBarProps {
  glass: boolean;
  hidden: boolean;
  focusedTab: TabRoute | null;
  onTabPress: (tab: TabRoute) => void;
  noticesBadge: string | null;
  showNoticesAccessory: boolean;
  onInsetChange: (inset: number) => void;
  onAccessoryChange: (height: number) => void;
}

export function SharedMapTabBar({
  glass,
  hidden,
  focusedTab,
  onTabPress,
  noticesBadge,
  showNoticesAccessory,
  onInsetChange,
  onAccessoryChange,
}: SharedMapTabBarProps) {
  const { left, right, bottom } = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { t, tpl } = useT();
  const geometry = useMemo(
    () => tabBarGeometry({ left, right, bottom }, windowWidth, TAB_ORDER.length),
    [left, right, bottom, windowWidth],
  );

  const accessory = showNoticesAccessory && glass && !hidden;
  useEffect(() => {
    onInsetChange(hidden ? 0 : geometry.inset);
  }, [hidden, geometry.inset, onInsetChange]);
  useEffect(() => {
    onAccessoryChange(accessory ? ACCESSORY_HEIGHT + FLOAT_GAP : 0);
  }, [accessory, onAccessoryChange]);

  // EVIDENCE: on the iOS 26.5 sim a tap gesture and the pressable both fired, and the second press popped a sheet as
  // a re-tap after the switch; `once` drops a second press on one tab within a touch, whichever path a11y takes.
  const lastPress = useRef({ index: -1, at: 0 });
  const triggers = useMemo(() => {
    const presses = new Map<number, TriggerPress>();
    const once = (index: number, run: () => void) => {
      const now = Date.now();
      const last = lastPress.current;
      if (index === last.index && now - last.at < SAME_TOUCH_MS) return;
      lastPress.current = { index, at: now };
      run();
    };
    return {
      register: (index: number, press: TriggerPress | undefined) => {
        if (press) presses.set(index, press);
        else presses.delete(index);
      },
      press: (index: number) => {
        const press = presses.get(index);
        if (press) once(index, () => pressWithoutTouch(press));
      },
      once,
    };
  }, []);
  const selectIndex = useCallback((index: number) => triggers.press(index), [triggers]);

  const items = useMemo(
    () =>
      TAB_ORDER.map((tab): GlassTabItem => {
        const { Icon, scale } = TAB_GLYPHS[tab];
        return {
          name: tab,
          label: t(`nav.${tab}`),
          renderIcon: ({ size, color, filled }) => (
            <Icon size={size * scale} color={color} weight={filled ? 'fill' : 'regular'} />
          ),
        };
      }),
    [t],
  );

  const progress = useTabBarMinimized();
  const accessoryStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: progress.get() * geometry.minimizedTopDrop }],
  }));

  const focusedIndex = focusedTab ? TAB_ORDER.indexOf(focusedTab) : -1;
  const { frame } = geometry;

  // WHY: a covered bar still reports its inset, so nothing laid out around it moves.
  const { coveredTabs } = useMapLayout();
  const covered = focusedTab !== null && isTabBarCovered(focusedTab, coveredTabs);

  return (
    <View
      style={[StyleSheet.absoluteFill, hidden ? styles.hidden : null, covered ? styles.covered : null]}
      pointerEvents={covered ? 'none' : 'box-none'}
      accessibilityElementsHidden={covered}
      importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}
    >
      {accessory ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.accessoryAnchor,
            { left: frame.left, right: frame.right, bottom: geometry.inset + FLOAT_GAP },
            accessoryStyle,
          ]}
        >
          <GlassSurface interactive style={styles.accessory}>
            <NoticesAccessoryBar />
          </GlassSurface>
        </Animated.View>
      ) : null}
      {/* QUIRK(react-native): `tabbar` throws on Android, which has no such role, so it gets `tablist`. */}
      <TabList asChild accessibilityRole={Platform.OS === 'ios' ? 'tabbar' : 'tablist'}>
        <GlassTabBar geometry={geometry} focusedIndex={focusedIndex} glass={glass} onIndexSelected={selectIndex}>
          {TAB_ORDER.map((tab, index) => {
            const { index: position, count: total } = tabPosition(tab);
            return (
              <TabTrigger key={tab} name={tab} href={`/${tab}`} asChild onPress={() => onTabPress(tab)}>
                <ShellGlassTab
                  index={index}
                  item={items[index] as GlassTabItem}
                  register={triggers.register}
                  once={triggers.once}
                  // QUIRK(ios): VoiceOver reads a tab's place from the tab bar trait itself; Android has none.
                  position={Platform.OS === 'android' ? tpl('nav.tabPosition', position, total) : undefined}
                  badge={tab === 'notices' ? noticesBadge : null}
                />
              </TabTrigger>
            );
          })}
        </GlassTabBar>
      </TabList>
    </View>
  );
}

interface ShellGlassTabProps extends TabTriggerSlotProps {
  index: number;
  item: GlassTabItem;
  register: (index: number, press: TriggerPress | undefined) => void;
  once: (index: number, run: () => void) => void;
  position: string | undefined;
  badge: string | null;
}

function ShellGlassTab({ index, item, register, once, position, badge, isFocused = false, onPress, ...slot }: ShellGlassTabProps) {
  useEffect(() => {
    register(index, onPress ?? undefined);
    return () => register(index, undefined);
  }, [index, onPress, register]);

  const pressOnce = useCallback(
    (event: GestureResponderEvent) => once(index, () => onPress?.(event)),
    [once, index, onPress],
  );

  return (
    <GlassTabButton
      {...slot}
      item={item}
      index={index}
      isFocused={isFocused}
      onPress={pressOnce}
      accessibilityRole="tab"
      accessibilityLabel={badge ? `${item.label}, ${badge}` : item.label}
      accessibilityState={{ selected: isFocused }}
      accessibilityValue={position ? { text: position } : undefined}
    >
      {badge ? (
        <Badge size="xsmall" color="onCriticalSolid" backgroundColor="criticalSolid" style={styles.badge}>
          {badge}
        </Badge>
      ) : null}
    </GlassTabButton>
  );
}

const styles = StyleSheet.create({
  hidden: {
    display: 'none',
  },
  covered: {
    zIndex: -1,
  },
  accessoryAnchor: {
    position: 'absolute',
  },
  accessory: {
    height: ACCESSORY_HEIGHT,
    borderRadius: SdsRadius.full,
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    top: -SdsSpacing.x1,
    left: SdsSpacing.x4,
  },
});
