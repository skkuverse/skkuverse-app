import type { TabRoute } from '@skkuverse/shared';

export const VALID_TABS: readonly TabRoute[] = ['home', 'campus', 'transit', 'notices'];

export function tabRouteToScreen(tab: TabRoute): string {
  return tab;
}

export function screenToTabRoute(name: string): TabRoute | null {
  if (name === 'home' || name === 'campus' || name === 'transit' || name === 'notices') {
    return name;
  }
  return null;
}
