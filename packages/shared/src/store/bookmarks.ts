import { create } from 'zustand';
import type { BookmarkEntry } from './bookmarks.types';

/**
 * WHY: not MMKV-persisted: Firestore's disk cache already serves a cold start, and a second cache
 * without its listener merge would bring back multi-device drift.
 */
interface BookmarkState {
  entries: Record<string, BookmarkEntry>;
  loaded: boolean;
}

interface BookmarkActions {
  setEntries: (entries: Record<string, BookmarkEntry>) => void;
  /** WHY: cleared on sign-out, so the next anonymous user on a shared device never sees the list. */
  clearEntries: () => void;
  /**
   * WHY: the caller reverts only on a permanent error; a network error stays, since Firestore's
   * offline queue retries it and the listener re-syncs.
   */
  applyLocal: (key: string, entry: BookmarkEntry | null) => void;
}

export type BookmarkStore = BookmarkState & BookmarkActions;

export const useBookmarkStore = create<BookmarkStore>((set) => ({
  entries: {},
  loaded: false,

  setEntries: (entries) => set({ entries, loaded: true }),
  clearEntries: () => set({ entries: {}, loaded: false }),
  applyLocal: (key, entry) =>
    set((state) => {
      const next = { ...state.entries };
      if (entry === null) {
        delete next[key];
      } else {
        next[key] = entry;
      }
      return { entries: next };
    }),
}));

export const bookmarkStore = useBookmarkStore;
