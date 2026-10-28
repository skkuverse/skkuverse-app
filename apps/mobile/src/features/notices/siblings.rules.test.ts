/**
 * The detail screen's previous and next notice, by posting order: the list is
 * newest first, so "previous" is the item below and "next" the one above.
 */
import { describe, expect, it } from 'vitest';
import { findSiblings, type NoticeSibling } from './siblings.rules';

const item = (articleNo: number, sourceId = 'cse'): NoticeSibling => ({
  sourceId,
  articleNo,
  title: `notice ${articleNo}`,
});
const items = [item(3), item(2), item(1)];

describe('findSiblings', () => {
  it('gives the newest notice a previous one and no next one', () => {
    // Assert
    expect(findSiblings(items, 'cse', 3)).toEqual({ prev: item(2), next: null });
  });

  it('gives a middle notice both', () => {
    // Assert
    expect(findSiblings(items, 'cse', 2)).toEqual({ prev: item(1), next: item(3) });
  });

  it('gives the oldest notice a next one and no previous one', () => {
    // Assert
    expect(findSiblings(items, 'cse', 1)).toEqual({ prev: null, next: item(2) });
  });

  it('gives neither for a notice not in the list, or from another source', () => {
    // Assert
    expect(findSiblings(items, 'cse', 9)).toEqual({ prev: null, next: null });
    expect(findSiblings(items, 'other', 2)).toEqual({ prev: null, next: null });
    expect(findSiblings([], 'cse', 2)).toEqual({ prev: null, next: null });
  });
});
