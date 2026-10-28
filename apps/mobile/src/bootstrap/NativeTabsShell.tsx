import { Tabs, useSegments, useNavigation } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import type { NavigationState } from "expo-router/react-navigation";
import { useEffect } from "react";
import { Platform } from "react-native";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { useT } from "@skkuverse/shared";
import type { TabRoute } from "@skkuverse/shared";
import { TAB_GLYPHS } from "@/bootstrap/tab-icons.constants";
import { VALID_TABS, screenToTabRoute, tabRouteToScreen } from "@/bootstrap/tabs.rules";
import { useTabLayout } from "@/bootstrap/useTabLayout";
import { useNoticesAccessory } from "@/features/notices/useNoticesAccessory";
import { logTabSwitch } from "@/platform/analytics";
import { NoticesAccessoryBar } from "@/features/notices/NoticesAccessoryBar";
import { Txt, useSemanticColors } from '@skkuverse/sds';

// WHY: the one predicate for NativeTabs here and for useTabFocusTracking; change both together.
const GLASS_AVAILABLE = isLiquidGlassAvailable();

// WHY: hidden, since builds before 3fcef06 persisted counts inflated by festival pushes. To restore, also bump the
// notifications store's persist version with a migrate zeroing unreadCount; tab-bar.rules.ts holds the other copy.
const NOTICES_BADGE_VISIBLE = false;

// QUIRK(react-navigation): the size @react-navigation/bottom-tabs gives a tab icon.
const JS_TAB_ICON_SIZE = 22;

function renderTabGlyph(tab: TabRoute, focused: boolean, active: string, inactive: string) {
  const { Icon, scale } = TAB_GLYPHS[tab];
  return <Icon size={JS_TAB_ICON_SIZE * scale} color={focused ? active : inactive} weight={focused ? "fill" : "regular"} />;
}

function NoticesBottomAccessoryGate() {
  const segments = useSegments();
  // WHY: only a pushed detail is filtered here; the tab and onboarding gates live in the parent, since null leaves a capsule.
  if (segments.length > 2) return null;
  return <NoticesAccessoryBar />;
}

export function NativeTabsShell() {
  const semantic = useSemanticColors();
  const iconActive = semantic.fg.neutral;
  const iconInactive = semantic.fg.placeholder;
  const { t } = useT();
  const { lastTab, setLastTab, unreadCount } = useTabLayout();
  // WHY: widened, since the inferred type comes from the Metro-generated router.d.ts, a 1-tuple on a clean checkout;
  // a type argument cannot do it, as the hook's constraint is that generated tuple.
  const segments: string[] = useSegments();
  const isNoticesTab =
    segments[0] === '(tabs)' && segments[1] === 'notices';
  // QUIRK(ios): UITabAccessory has no opt-out, so a gated accessory must be absent, not render null, or an empty capsule shows.
  const noticesAccessoryAllowed = useNoticesAccessory();
  const showNoticesAccessory = isNoticesTab && noticesAccessoryAllowed;

  const initialTab: TabRoute = VALID_TABS.includes(lastTab) ? lastTab : 'home';
  const initialRouteName = tabRouteToScreen(initialTab);

  // QUIRK(ios): the long-press back menu reads the root Stack's (tabs) entry title, which this navigation resolves to.
  const navigation = useNavigation();
  const activeTabKey: TabRoute =
    segments[0] === '(tabs)' && VALID_TABS.includes(segments[1] as TabRoute)
      ? (segments[1] as TabRoute)
      : initialTab;

  useEffect(() => {
    navigation.setOptions({ title: t(`nav.${activeTabKey}`) });
  }, [activeTabKey, t, navigation]);

  // QUIRK(react-navigation): a falsy number still renders a badge on some versions, so none is undefined.
  const noticesBadge: number | string | undefined =
    NOTICES_BADGE_VISIBLE && unreadCount > 0
      ? (unreadCount > 99 ? '99+' : unreadCount)
      : undefined;

  // QUIRK(ios): below 26 the default scrollEdgeAppearance is transparent, so those devices take the opaque JS `<Tabs>`.
  if (Platform.OS === 'ios' && GLASS_AVAILABLE) {
    return (
      <NativeTabs
        iconColor={{ default: iconInactive, selected: iconActive }}
        labelStyle={{
          default: { color: iconInactive },
          selected: { color: iconActive },
        }}
        // QUIRK(react-native-screens): a tab screen's root must be a ScrollView, SectionList or FlatList, or the bar
        // never minimizes. SEE: docs/explanation/ios-26-native-tabs-minimize.md
        minimizeBehavior="onScrollDown"
      >
        {/* QUIRK(ios): glass is forced on an attached UITabAccessory; only removing the subtree hides the capsule. */}
        {showNoticesAccessory && (
          <NativeTabs.BottomAccessory>
            <NoticesBottomAccessoryGate />
          </NativeTabs.BottomAccessory>
        )}
        <NativeTabs.Trigger name="home">
          <NativeTabs.Trigger.Icon
            src={{
              default: require('../../assets/tab-icons/squares-four-outline.png'),
              selected: require('../../assets/tab-icons/squares-four-filled.png'),
            }}
          />
          <NativeTabs.Trigger.Label>{t("nav.home")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="notices">
          <NativeTabs.Trigger.Icon
            src={{
              default: require('../../assets/tab-icons/megaphone-simple-outline.png'),
              selected: require('../../assets/tab-icons/megaphone-simple-filled.png'),
            }}
          />
          <NativeTabs.Trigger.Label>{t("nav.notices")}</NativeTabs.Trigger.Label>
          {NOTICES_BADGE_VISIBLE && unreadCount > 0 && (
            <NativeTabs.Trigger.Badge>{unreadCount > 99 ? '99+' : String(unreadCount)}</NativeTabs.Trigger.Badge>
          )}
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="campus">
          <NativeTabs.Trigger.Icon
            src={{
              default: require('../../assets/tab-icons/map-trifold-outline.png'),
              selected: require('../../assets/tab-icons/map-trifold-filled.png'),
            }}
          />
          <NativeTabs.Trigger.Label>{t("nav.campus")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="transit">
          <NativeTabs.Trigger.Icon
            src={{
              default: require('../../assets/tab-icons/bus-outline.png'),
              selected: require('../../assets/tab-icons/bus-filled.png'),
            }}
          />
          <NativeTabs.Trigger.Label>{t("nav.transit")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs
      initialRouteName={initialRouteName}
      screenListeners={{
        state: (e) => {
          const state = (e.data as { state: NavigationState }).state;
          const route = state.routes[state.index];
          const mapped = route?.name ? screenToTabRoute(route.name) : null;
          if (mapped) {
            logTabSwitch(mapped, { withCause: false });
            setLastTab(mapped);
          }
        },
      }}
      screenOptions={{
        tabBarActiveTintColor: iconActive,
        tabBarInactiveTintColor: iconInactive,
        tabBarStyle: {
          backgroundColor: semantic.bg.layerDefault,
          borderTopColor: semantic.stroke.neutralMuted,
          borderTopWidth: 0.5,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t("nav.home"),
          tabBarIcon: ({ focused }) => renderTabGlyph("home", focused, iconActive, iconInactive),
          tabBarLabel: ({ focused }) => (
            <Txt typography="t1" fontWeight={focused ? "medium" : "regular"} color={focused ? "neutral" : "placeholder"}>
              {t("nav.home")}
            </Txt>
          ),
        }}
      />
      <Tabs.Screen
        name="notices"
        options={{
          title: t("nav.notices"),
          tabBarBadge: noticesBadge,
          tabBarIcon: ({ focused }) => renderTabGlyph("notices", focused, iconActive, iconInactive),
          tabBarLabel: ({ focused }) => (
            <Txt typography="t1" fontWeight={focused ? "medium" : "regular"} color={focused ? "neutral" : "placeholder"}>
              {t("nav.notices")}
            </Txt>
          ),
        }}
      />
      <Tabs.Screen
        name="campus"
        options={{
          title: t("nav.campus"),
          tabBarIcon: ({ focused }) => renderTabGlyph("campus", focused, iconActive, iconInactive),
          tabBarLabel: ({ focused }) => (
            <Txt typography="t1" fontWeight={focused ? "medium" : "regular"} color={focused ? "neutral" : "placeholder"}>
              {t("nav.campus")}
            </Txt>
          ),
        }}
      />
      <Tabs.Screen
        name="transit"
        options={{
          title: t("nav.transit"),
          tabBarIcon: ({ focused }) => renderTabGlyph("transit", focused, iconActive, iconInactive),
          tabBarLabel: ({ focused }) => (
            <Txt typography="t1" fontWeight={focused ? "medium" : "regular"} color={focused ? "neutral" : "placeholder"}>
              {t("nav.transit")}
            </Txt>
          ),
        }}
      />
    </Tabs>
  );
}
