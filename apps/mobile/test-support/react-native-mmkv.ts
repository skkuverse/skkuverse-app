// An in-memory react-native-mmkv for vitest (apps/mobile/vitest.config.ts):
// the subset of the v4 MMKV interface the app uses, one store per id.
const stores = new Map<string, Map<string, string>>();

export function createMMKV({ id }: { id: string }) {
  const store = stores.get(id) ?? new Map<string, string>();
  stores.set(id, store);
  return {
    getString: (key: string): string | undefined => store.get(key),
    set: (key: string, value: string): void => {
      store.set(key, value);
    },
    remove: (key: string): boolean => store.delete(key),
    contains: (key: string): boolean => store.has(key),
    getAllKeys: (): string[] => [...store.keys()],
    clearAll: (): void => store.clear(),
  };
}

/** Empties every store; call it in `beforeEach`. */
export function resetMMKV(): void {
  for (const store of stores.values()) store.clear();
}
