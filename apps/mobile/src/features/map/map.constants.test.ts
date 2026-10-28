/**
 * The bundled fallback mirrors what production serves, so a launch with no
 * config and no copy frames the same campus a served config would.
 */
import { describe, expect, it } from 'vitest';
import production from './__fixtures__/server-map-config.production-ko.json';
import { DEFAULT_CAMPUS_RADIUS_M, DEFAULT_MAP_CONFIG, FALLBACK_CAMPUS } from './map.constants';

describe('DEFAULT_MAP_CONFIG campuses', () => {
  it('frame each campus where production does', () => {
    // Arrange
    const served = production.data.campuses.map(({ radiusM: _radius, ...campus }) => campus);

    // Act
    const bundled = DEFAULT_MAP_CONFIG.campuses;

    // Assert
    expect(bundled).toStrictEqual(served);
  });

  it('fall back to the first campus production serves', () => {
    // Act & Assert
    expect(DEFAULT_MAP_CONFIG.campuses[0]).toBe(FALLBACK_CAMPUS);
  });

  it('fall back to the radius production serves', () => {
    // Act & Assert
    expect(production.data.campuses.map((c) => c.radiusM)).toStrictEqual([DEFAULT_CAMPUS_RADIUS_M, DEFAULT_CAMPUS_RADIUS_M]);
  });
});
