import { useNoticeSiblingsStore } from './notices.store';

/** WHY: a setter only, so a list does not re-render when the items it set change. */
export function useSetNoticeSiblings() {
  return useNoticeSiblingsStore((s) => s.setItems);
}
