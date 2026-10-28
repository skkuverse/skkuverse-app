import { describe, it, expect, vi } from 'vitest';
import { createPendingSlot } from '../pending-slot.store';

describe('createPendingSlot', () => {
  it('hands a value to one consume, then holds nothing', () => {
    // Arrange
    const slot = createPendingSlot<{ id: string }>({ name: 'test' });
    slot.set({ id: 'a' });

    // Act
    const first = slot.consume();
    const second = slot.consume();

    // Assert
    expect(first).toStrictEqual({ id: 'a' });
    expect(second).toBeNull();
  });

  it('keeps only the newest of two unread values', () => {
    // Arrange
    const slot = createPendingSlot<string>({ name: 'test' });
    slot.set('old');
    slot.set('new');

    // Act & Assert
    expect(slot.consume()).toBe('new');
    expect(slot.consume()).toBeNull();
  });

  it('leaves a value its consumer refuses for the next one', () => {
    // Arrange
    const slot = createPendingSlot<{ tab: 'map' | 'transit' }>({ name: 'test' });
    slot.set({ tab: 'transit' });

    // Act
    const refused = slot.consume((v) => v.tab === 'map');
    const taken = slot.consume((v) => v.tab === 'transit');

    // Assert
    expect(refused).toBeNull();
    expect(taken).toStrictEqual({ tab: 'transit' });
    expect(slot.consume()).toBeNull();
  });

  it('holds a falsy value as a value', () => {
    // Arrange
    const slot = createPendingSlot<boolean>({ name: 'test' });
    slot.set(false);

    // Act & Assert
    expect(slot.consume()).toBe(false);
    expect(slot.consume()).toBeNull();
  });

  it('tells each subscriber after the value is readable, until it unsubscribes', () => {
    // Arrange
    const slot = createPendingSlot<string>({ name: 'test' });
    const seen: (string | null)[] = [];
    const unsubscribe = slot.subscribe(() => seen.push(slot.consume()));

    // Act
    slot.set('a');
    unsubscribe();
    slot.set('b');

    // Assert
    expect(seen).toStrictEqual(['a']);
    expect(slot.consume()).toBe('b');
  });

  it('logs set and a taken value with what describe names, a refused one as refused, and an empty consume not at all', () => {
    // Arrange
    const log = vi.fn();
    const slot = createPendingSlot<{ id: string; tab: string; secret: string }>({
      name: 'pendingX',
      log,
      describe: (v) => ({ id: v.id, tab: v.tab }),
    });
    slot.subscribe(() => {});

    // Act
    slot.set({ id: 'a', tab: 'transit', secret: 's' });
    slot.consume((v) => v.tab === 'map');
    slot.consume((v) => v.tab === 'transit');
    slot.consume();

    // Assert
    expect(log.mock.calls).toStrictEqual([
      ['pendingX.set', { id: 'a', tab: 'transit', listenerCount: 1 }],
      ['pendingX.consume', { id: 'a', tab: 'transit', outcome: 'refused' }],
      ['pendingX.consume', { id: 'a', tab: 'transit', outcome: 'taken' }],
    ]);
  });
});
