/** The campus sheet key, pinned as a literal so a move cannot split its cache. */
import { describe, expect, it } from 'vitest';
import { campusSectionsQueryOptions } from './campus-sheet.client';

describe('campus sections query key', () => {
  it('keys the sections alone', () => {
    // Act
    const key = campusSectionsQueryOptions().queryKey;

    // Assert
    expect(key).toStrictEqual(['campus', 'sections']);
  });
});
