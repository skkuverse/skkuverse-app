import { describe, expect, it } from 'vitest';
import { VALID_TABS, screenToTabRoute, tabRouteToScreen } from './tabs.rules';

describe('tab mapping', () => {
  it('maps every tab to the screen of the same name and back', () => {
    // Act / Assert
    expect(VALID_TABS).toStrictEqual(['home', 'campus', 'transit', 'notices']);
    for (const tab of VALID_TABS) {
      expect(tabRouteToScreen(tab)).toBe(tab);
      expect(screenToTabRoute(tab)).toBe(tab);
    }
  });

  it.each(['index', 'search', '(tabs)', '', 'Home'])('reads the non-tab screen %j as no tab', (name) => {
    // Act / Assert
    expect(screenToTabRoute(name)).toBe(null);
  });
});
