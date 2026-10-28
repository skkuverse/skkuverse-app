/** The tab route a map tab lives at, and back. */

import { describe, it, expect } from 'vitest';
import { mapTabOf, tabRouteOf } from './map-tabs.rules';

describe('tabRouteOf: the route a map tab lives at', () => {
  it.each([
    ['map', 'campus'],
    ['transit', 'transit'],
  ] as const)('the %s tab is the %s route', (tab, route) => {
    expect(tabRouteOf(tab)).toBe(route);
  });
});

describe('mapTabOf', () => {
  it('maps the campus route to the map tab, transit to transit, and the rest to no map', () => {
    expect(mapTabOf('campus')).toBe('map');
    expect(mapTabOf('transit')).toBe('transit');
    expect(mapTabOf('home')).toBeNull();
    expect(mapTabOf('notices')).toBeNull();
  });
});
