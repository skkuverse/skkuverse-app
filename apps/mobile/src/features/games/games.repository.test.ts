/**
 * The ghost line — where a result not on the board yet would rank, shown
 * before it is submitted (`useRankOf`) — is still counted on this side; only
 * the rank after a write comes from the server now. Only the Firestore SDK is
 * a double.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rankOf } from './games.repository';

const sdk = vi.hoisted(() => ({
  where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  query: vi.fn((_ref: unknown, ...constraints: unknown[]) => ({ constraints })),
  getCountFromServer: vi.fn(),
}));

vi.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => ({}),
  collection: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  query: sdk.query,
  where: sdk.where,
  getCountFromServer: sdk.getCountFromServer,
}));

beforeEach(() => {
  sdk.where.mockClear();
  sdk.getCountFromServer.mockReset().mockResolvedValue({ data: () => ({ count: 4 }) });
});

describe('rankOf (the ghost prediction)', () => {
  it('counts the entries strictly better, plus one: higher for a distance', async () => {
    await expect(rankOf('wave-run', 'desc', 850)).resolves.toBe(5);
    expect(sdk.where).toHaveBeenCalledWith('score', '>', 850);
  });

  it('lower for a time', async () => {
    await expect(rankOf('subway-typing', 'asc', 9520)).resolves.toBe(5);
    expect(sdk.where).toHaveBeenCalledWith('score', '<', 9520);
  });
});
