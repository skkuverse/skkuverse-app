/**
 * vitest resolves apps/mobile's aliases the way tsconfig.json does, and swaps
 * react-native-mmkv for the in-memory store, so a module test needs no setup.
 */
import { describe, expect, it } from 'vitest';
import { createMMKV } from 'react-native-mmkv';
import { parseWebMessage } from '@skkuverse/bridge';
import { normalizeWebUrl } from '@/features/web/web-url.rules';

describe('vitest in apps/mobile', () => {
  it('resolves @/ to src', () => {
    // Act
    const result = normalizeWebUrl('http://example.com');

    // Assert
    expect(result).toEqual({ url: 'https://example.com', isWeb: true });
  });

  it('resolves @skkuverse/<package> to its src', () => {
    // Act
    const message = parseWebMessage('not json');

    // Assert
    expect(message).toBeNull();
  });

  it('serves react-native-mmkv from memory', () => {
    // Arrange
    const store = createMMKV({ id: 'aliases-test' });

    // Act
    store.set('k', 'v');

    // Assert
    expect(store.getString('k')).toBe('v');
  });
});
