// WHY: re-implements what NativeTabs gave for free (ADR 0023 d3); a gap here is a regression from the native shell.

import type { TabRoute } from '@skkuverse/shared';
import { MAP_TAB_OF_ROUTE } from '@/features/map/map-tabs.constants';
import type { MapTabId } from '@/features/map/map-config.types';

export const TAB_ORDER: readonly TabRoute[] = ['home', 'notices', 'campus', 'transit'];

/**
 * QUIRK(expo-router): back defaults to `firstRoute`, and the restored tab is put first, so anything but
 * 'none' loops a cold start on a map tab between it and home.
 */
export const TAB_BACK_BEHAVIOR = 'none' as const;

// WHY: NativeTabsShell holds its own copy, off for the festival's inflated counts; flip both together.
export const NOTICES_BADGE_VISIBLE = false;

// QUIRK(react-navigation): a Stack above its root pops itself on the same re-tap, so its scroller finds the screen unfocused and stays put.
export type RetapDecision = { kind: 'mapTask'; tab: MapTabId } | { kind: 'scrollToTop'; tab: TabRoute };

export function decideRetap(route: TabRoute): RetapDecision {
  const mapTab = MAP_TAB_OF_ROUTE[route];
  return mapTab ? { kind: 'mapTask', tab: mapTab } : { kind: 'scrollToTop', tab: route };
}

export type ShellBackDecision = { kind: 'system' } | { kind: 'mapTab'; tab: MapTabId } | { kind: 'home' };

export function decideShellBack(route: TabRoute | null): ShellBackDecision {
  if (route === 'notices') return { kind: 'home' };
  const mapTab = route ? MAP_TAB_OF_ROUTE[route] : null;
  return mapTab ? { kind: 'mapTab', tab: mapTab } : { kind: 'system' };
}

export function noticesBadge(unreadCount: number, visible: boolean): string | null {
  if (!visible || unreadCount <= 0) return null;
  return unreadCount > 99 ? '99+' : String(unreadCount);
}

export function tabPosition(tab: TabRoute): { index: number; count: number } {
  return { index: TAB_ORDER.indexOf(tab) + 1, count: TAB_ORDER.length };
}

// WHY: a map tab clears the bar alone, since its sheet measures its own overlap.
export function tabContentLayout(route: TabRoute, chrome: { bar: number; accessory: number }): { inset: number } {
  if (MAP_TAB_OF_ROUTE[route]) return { inset: chrome.bar };
  return { inset: chrome.bar + chrome.accessory };
}

export function isTabBarCovered(route: TabRoute, covered: Partial<Record<MapTabId, boolean>>): boolean {
  const tab = MAP_TAB_OF_ROUTE[route];
  return tab !== null && covered[tab] === true;
}
