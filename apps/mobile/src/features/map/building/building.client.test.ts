/** The building query keys, pinned as literals so a move cannot split their caches. */
import { describe, expect, it } from 'vitest';
import { buildingDetailQueryOptions, buildingSearchQueryOptions } from './building.client';

describe('building query keys', () => {
  it('keys a detail by its skku id', () => {
    // Act
    const key = buildingDetailQueryOptions(31).queryKey;

    // Assert
    expect(key).toStrictEqual(['building', 'detail', 31]);
  });

  it('keys a search by query and campus', () => {
    // Act
    const scoped = buildingSearchQueryOptions('경영', 'hssc').queryKey;
    const all = buildingSearchQueryOptions('경영').queryKey;

    // Assert
    expect(scoped).toStrictEqual(['building', 'search', '경영', 'hssc']);
    expect(all).toStrictEqual(['building', 'search', '경영', undefined]);
  });
});
