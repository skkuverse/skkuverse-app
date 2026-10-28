import { describe, expect, it } from 'vitest';
import { toFeedRoute } from './feed.constants';

describe('toFeedRoute — the push contract', () => {
  it.each([
    ['eskara-2026', '/miniapp-feed/eskara-2026'],
    ['a b/c', '/miniapp-feed/a%20b%2Fc'],
  ])('%s', (miniAppId, expected) => {
    // Act & Assert
    expect(toFeedRoute(miniAppId)).toBe(expected);
  });
});
