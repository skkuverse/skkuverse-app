/**
 * The pending transit sheet (ADR 0022 d7): what `/transit?line=` and the
 * redirected `/bus/realtime` and `/subway` routes leave for the transit tab
 * to open.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { transitSheetQueue } from './transit.store';

beforeEach(() => {
  transitSheetQueue.consume();
});

describe('transitSheetQueue', () => {
  it('hands a set request to its one consumer, once', () => {
    // Act
    transitSheetQueue.set({ kind: 'line', groupId: 'hssc', source: 'deeplink' });

    // Assert
    expect(transitSheetQueue.consume()).toStrictEqual({ kind: 'line', groupId: 'hssc', source: 'deeplink' });
    expect(transitSheetQueue.consume()).toBeNull();
  });

  it('keeps the last request set before it is consumed', () => {
    // Act
    transitSheetQueue.set({ kind: 'line', groupId: 'hssc', source: 'deeplink' });
    transitSheetQueue.set({ kind: 'subway_station', stationId: 'hyehwa', line: '4', source: 'deeplink' });

    // Assert
    expect(transitSheetQueue.consume()).toStrictEqual({ kind: 'subway_station', stationId: 'hyehwa', line: '4', source: 'deeplink' });
  });

  it('tells a subscriber on every set, until it unsubscribes', () => {
    // Arrange
    const listener = vi.fn();
    const unsubscribe = transitSheetQueue.subscribe(listener);

    // Act
    transitSheetQueue.set({ kind: 'line', groupId: 'hssc', source: 'deeplink' });
    unsubscribe();
    transitSheetQueue.set({ kind: 'line', groupId: 'jongro07', source: 'deeplink' });

    // Assert
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
