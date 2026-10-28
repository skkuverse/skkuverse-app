import { createMMKV } from 'react-native-mmkv';

/**
 * WHY: apart from the settings MMKV: everything here is a disposable copy of server data, so clearing
 * it never loses user state, and a fresh fetch always wins over it.
 */
const cacheMmkv = createMMKV({ id: 'skkuverse-cache' });

/**
 * WHY: `validate` is required: the cache outlives app updates, so a value an older build wrote can be
 * the wrong shape, and trusting it crashes the first launch after the update.
 */
export function readCache<T>(
  key: string,
  validate: (raw: unknown) => T | null,
): T | null {
  const raw = cacheMmkv.getString(key);
  if (raw === undefined) return null;
  try {
    return validate(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeCache(key: string, value: unknown): void {
  try {
    cacheMmkv.set(key, JSON.stringify(value));
  } catch {
    // WHY: the live value is already in hand, and the next successful fetch retries the write.
  }
}

export function clearCache(key: string): void {
  cacheMmkv.remove(key);
}
