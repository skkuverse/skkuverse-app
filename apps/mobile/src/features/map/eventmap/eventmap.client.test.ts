/** The place-details key, pinned as a literal so a move cannot split its cache. */
import { describe, expect, it } from 'vitest';
import { placeDetailsQueryOptions } from './eventmap.client';

describe('place details query key', () => {
  it('keys the details by the overlay endpoint with /details appended', () => {
    // Act
    const key = placeDetailsQueryOptions('/map/overlays/event').queryKey;

    // Assert
    expect(key).toStrictEqual(['eventmap', 'place', 'details', '/map/overlays/event/details']);
  });

  it('keys a missing endpoint as null and asks for nothing', () => {
    // Act
    const options = placeDetailsQueryOptions(null);

    // Assert
    expect(options.queryKey).toStrictEqual(['eventmap', 'place', 'details', null]);
    expect(options.enabled).toBe(false);
  });
});
