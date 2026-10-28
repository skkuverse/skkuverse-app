/**
 * The query keys the map client builds, pinned as literals, so a move or a
 * port can never split one cache into two or merge two into one.
 */
import { describe, expect, it } from 'vitest';
import { layerOverlaysQueryOptions, mapConfigQueryOptions } from './map.client';

describe('map query keys', () => {
  it('keys the config alone', () => {
    // Act
    const key = mapConfigQueryOptions().queryKey;

    // Assert
    expect(key).toStrictEqual(['map', 'config']);
  });

  it('keys overlays by their source endpoint', () => {
    // Act
    const key = layerOverlaysQueryOptions('/map/overlays/campus', true).queryKey;

    // Assert
    expect(key).toStrictEqual(['map', 'layer', 'overlays', '/map/overlays/campus']);
  });
});
