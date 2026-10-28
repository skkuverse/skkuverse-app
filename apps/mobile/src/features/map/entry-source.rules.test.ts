/** How a place or building sheet records the way it was reached. */

import { describe, it, expect } from 'vitest';
import { buildingDetailSourceOf, placeRequestSource, placeTapSource } from './entry-source.rules';

describe('placeRequestSource: what asked for a place', () => {
  it.each([
    [undefined, 'deeplink'],
    ['deeplink', 'deeplink'],
    ['miniapp', 'miniapp'],
    ['webview', 'webview'],
    ['sdui', 'sdui'],
    ['place_sheet', 'place_sheet'],
    ['pin', 'other'],
    ['tab', 'other'],
  ] as const)('%s reads as %s', (source, expected) => {
    expect(placeRequestSource(source)).toBe(expected);
  });
});

describe('buildingDetailSourceOf: the source building_view has always sent', () => {
  it.each([
    ['pin', 'marker'],
    ['search', 'search'],
    ['building_sheet', 'connection'],
    ['deeplink', 'direct'],
    ['miniapp', 'direct'],
    ['place_sheet', 'direct'],
    ['other', 'direct'],
  ] as const)('a building reached from %s logs %s', (source, expected) => {
    expect(buildingDetailSourceOf(source)).toBe(expected);
  });
});

describe('placeTapSource: how a tapped overlay is recorded', () => {
  it.each([
    ['marker', 'pin'],
    ['path', 'path'],
    ['polygon', 'zone'],
  ] as const)('a %s is a %s', (kind, expected) => {
    expect(placeTapSource(kind)).toBe(expected);
  });
});
