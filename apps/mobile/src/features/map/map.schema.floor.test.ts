/**
 * The floor under an unreadable layer list: a served list with no readable
 * layer is a response this build cannot draw a map from, so the parse fails,
 * and the query keeps its last good copy or the hook applies the bundled
 * config (`map.client.cache.test.ts`). SEE: spec map/map-data-parsing,
 * "An unreadable configuration keeps the last good map".
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP_CONFIG } from './map.constants';
import { mapConfigSchema } from './map-config.schema';

const parseWith = (layers: unknown) => mapConfigSchema.safeParse({ layers, campuses: [], chips: [] });

describe('mapConfigSchema floor', () => {
  it('fails when every served layer is null', () => {
    // Act
    const out = parseWith([null, null]);

    // Assert
    expect(out.success).toBe(false);
  });

  it('fails when every served layer is a scalar', () => {
    // Act
    const out = parseWith([5, 5]);

    // Assert
    expect(out.success).toBe(false);
  });

  it('fails when the only surviving layer has an unreadable default visibility', () => {
    // Act
    const out = parseWith([null, { id: 'a', defaultVisibleWhen: { kind: 'bogus' } }]);

    // Assert
    expect(out.success).toBe(false);
  });

  it('keeps an empty served list as a config with no layers', () => {
    // Act
    const out = parseWith([]);

    // Assert
    expect(out.success && out.data).not.toBe(DEFAULT_MAP_CONFIG);
    expect(out.success && out.data.layers).toStrictEqual([]);
  });
});
