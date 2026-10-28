/**
 * The shared-map shell's tab bar decisions (ADR 0023 d3): what a re-tap does,
 * what the Android back key does, the notices badge, each tab's position, and
 * who clears the bar at the bottom of each tab.
 */

import { describe, it, expect } from 'vitest';
import { TabActions, TabRouter } from 'expo-router/build/react-navigation/routers/TabRouter';
import type { TabRoute } from '@skkuverse/shared';
import {
  TAB_BACK_BEHAVIOR,
  TAB_ORDER,
  decideRetap,
  decideShellBack,
  isTabBarCovered,
  noticesBadge,
  tabContentLayout,
  tabPosition,
} from './tab-bar.rules';

describe('decideRetap', () => {
  it("leaves a map tab's re-tap to its task", () => {
    // Act / Assert
    expect(decideRetap('campus')).toStrictEqual({ kind: 'mapTask', tab: 'map' });
    expect(decideRetap('transit')).toStrictEqual({ kind: 'mapTask', tab: 'transit' });
  });

  it('scrolls home and notices to top', () => {
    // Act / Assert
    expect(decideRetap('home')).toStrictEqual({ kind: 'scrollToTop', tab: 'home' });
    expect(decideRetap('notices')).toStrictEqual({ kind: 'scrollToTop', tab: 'notices' });
  });
});

describe('decideShellBack', () => {
  it('leaves the key to the system on home and off the tabs, and sends notices home', () => {
    // Act / Assert
    expect(decideShellBack('home')).toStrictEqual({ kind: 'system' });
    expect(decideShellBack('notices')).toStrictEqual({ kind: 'home' });
    expect(decideShellBack(null)).toStrictEqual({ kind: 'system' });
  });

  it("leaves a map tab's back to its sheet stack", () => {
    // Act / Assert
    expect(decideShellBack('campus')).toStrictEqual({ kind: 'mapTab', tab: 'map' });
    expect(decideShellBack('transit')).toStrictEqual({ kind: 'mapTab', tab: 'transit' });
  });
});

describe('noticesBadge', () => {
  it('shows nothing while the switch is off', () => {
    // Act / Assert
    expect(noticesBadge(5, false)).toBeNull();
  });

  it('shows the count, capped at 99+, and nothing at zero', () => {
    // Act / Assert
    expect(noticesBadge(0, true)).toBeNull();
    expect(noticesBadge(1, true)).toBe('1');
    expect(noticesBadge(99, true)).toBe('99');
    expect(noticesBadge(100, true)).toBe('99+');
  });
});

describe('tabPosition', () => {
  it('numbers the tabs from 1 in bar order, out of four', () => {
    // Act / Assert
    expect(TAB_ORDER).toStrictEqual(['home', 'notices', 'campus', 'transit']);
    expect(TAB_ORDER.map(tabPosition)).toStrictEqual([
      { index: 1, count: 4 },
      { index: 2, count: 4 },
      { index: 3, count: 4 },
      { index: 4, count: 4 },
    ]);
  });
});

describe('tabContentLayout', () => {
  it('runs the map tabs under the bar, which they clear themselves, the accessory aside', () => {
    // Act / Assert
    expect(tabContentLayout('campus', { bar: 90, accessory: 56 })).toStrictEqual({ inset: 90 });
    expect(tabContentLayout('transit', { bar: 90, accessory: 0 })).toStrictEqual({ inset: 90 });
  });

  it('lets home and notices scroll under the floating bar, clearing it and the accessory themselves', () => {
    // Act / Assert
    expect(tabContentLayout('home', { bar: 90, accessory: 0 })).toStrictEqual({ inset: 90 });
    expect(tabContentLayout('notices', { bar: 90, accessory: 56 })).toStrictEqual({ inset: 146 });
  });
});

describe('the tab router on back', () => {
  // expo-router puts the restored tab (`initialRouteName`) first in the route list.
  const coldStartOn = (tab: TabRoute) => [tab, ...TAB_ORDER.filter((t) => t !== tab)];

  /** The router after a cold start on `tab` and the shell's back decision at its root, which navigates home. */
  function atHomeAfterColdStartOn(tab: TabRoute, backBehavior?: typeof TAB_BACK_BEHAVIOR) {
    const options = { routeNames: coldStartOn(tab), routeParamList: {}, routeGetIdList: {} };
    const router = TabRouter({ initialRouteName: tab, ...(backBehavior && { backBehavior }) });
    const start = router.getInitialState(options);
    const jumped = router.getStateForAction(start, TabActions.jumpTo('home'), options);
    if (!jumped) throw new Error('expected the jump home to be handled');
    const home = router.getRehydratedState(jumped, options);
    const back = router.getStateForAction(home, { type: 'GO_BACK' }, options);
    const focused = (state: { routes: { name: string }[]; index?: number }) => state.routes[state.index ?? 0]?.name;
    return { home: focused(home), back: back ? focused(back) : null };
  }

  it('hands the key to the system at home after a cold start on a map tab, so the app exits instead of looping', () => {
    // Act
    const { home, back } = atHomeAfterColdStartOn('campus', TAB_BACK_BEHAVIOR);

    // Assert
    expect(home).toBe('home');
    expect(back).toBeNull();
  });

  it('would return to the map tab under the router\u2019s default, which is the loop', () => {
    // Act
    const { home, back } = atHomeAfterColdStartOn('transit');

    // Assert
    expect(home).toBe('home');
    expect(back).toBe('transit');
  });
});

describe('isTabBarCovered: whether the focused tab draws a sheet over the bar', () => {
  const covered = { map: false, transit: true } as const;

  it('is covered while the focused map tab has a sheet opened from its root', () => {
    expect(isTabBarCovered('transit', covered)).toBe(true);
  });

  it('is not covered while the focused map tab shows its root', () => {
    expect(isTabBarCovered('campus', covered)).toBe(false);
  });

  it('is never covered on a tab with no map, whatever a map tab has open', () => {
    expect(isTabBarCovered('home', covered)).toBe(false);
    expect(isTabBarCovered('notices', covered)).toBe(false);
  });

  it('is not covered for a tab that has not reported yet', () => {
    expect(isTabBarCovered('transit', {})).toBe(false);
  });
});
