import { createMMKV } from 'react-native-mmkv';

/**
 * WHY: the count rides on the event, so "how often does one person come back" needs no join over their
 * history; it is local and approximate on purpose, and a reinstall starts it over.
 */
const mmkv = createMMKV({ id: 'usage-counters' });

export type UsageKey = 'miniapp' | `miniapp:${string}` | 'game_open' | `game_open:${string}` | `game:${string}`;

export function bumpUsage(key: UsageKey): number {
  const n = (mmkv.getNumber(key) ?? 0) + 1;
  mmkv.set(key, n);
  return n;
}
