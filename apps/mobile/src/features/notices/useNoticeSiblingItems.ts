import { useNoticeSiblingsStore } from './notices.store';

export function useNoticeSiblingItems() {
  return useNoticeSiblingsStore((s) => s.items);
}
