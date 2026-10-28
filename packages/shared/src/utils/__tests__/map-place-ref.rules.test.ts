import { describe, it, expect } from 'vitest';
import { parseMapPlaceRef } from '../map-place-ref.rules';

describe('parseMapPlaceRef', () => {
  it.each([
    ['event:eskara-2026-wristband-guest', { kind: 'event', placeId: 'eskara-2026-wristband-guest' }],
    ['skku_building:31', { kind: 'skku_building', placeId: '31' }],
    ['eskara-2026-wristband-guest', { kind: null, placeId: 'eskara-2026-wristband-guest' }],
  ])('parses %s', (value, expected) => {
    expect(parseMapPlaceRef(value)).toEqual(expected);
  });

  it.each([
    ['bus_stop:01-123', { kind: 'bus_stop', placeId: '01-123' }],
    ['subway_station:0150', { kind: 'subway_station', placeId: '0150' }],
  ])('parses the transit kind %s', (value, expected) => {
    expect(parseMapPlaceRef(value)).toEqual(expected);
  });

  it.each([
    ['a kind that only prefixes a known one', 'bus:01-123'],
    ['an uppercase kind', 'BUS_STOP:01-123'],
    ['an empty transit id', 'subway_station:'],
  ])('refuses %s', (_label, value) => {
    expect(parseMapPlaceRef(value)).toBeNull();
  });

  it.each([
    ['an unknown kind', 'stage:main'],
    ['a path traversal', '../x'],
    ['a slash', 'event:a/b'],
    ['whitespace', 'event:a b'],
    ['a trailing newline', 'event:a\n'],
    ['an uppercase id', 'event:Wristband'],
    ['an empty string', ''],
    ['an empty id', 'event:'],
    ['a URL', 'https://evil.com'],
    ['a non-string', 31],
  ])('refuses %s', (_label, value) => {
    expect(parseMapPlaceRef(value)).toBeNull();
  });
});
