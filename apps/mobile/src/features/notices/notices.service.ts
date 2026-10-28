import { useBookmarkStore, useSettingsStore, type BookmarkEntry, type PreferencesDocument } from '@skkuverse/shared';
import { assembleOnboardingPickerSelections } from './onboarding/picker-selections.rules';
import { onBookmarksChanged } from './notices.repository';

/** WHY: an outside notice link is queued here and drained by the root layout's consumer once navigation is ready. */
export { externalNoticeLinkQueue as pendingExternalNoticeLink } from './notices.store';

export function onboardingRestore(): { pickerSelections: Record<string, string[]>; onboarded: true } | undefined {
  const settings = useSettingsStore.getState();
  return settings.onboardingCompleted
    ? {
        pickerSelections: assembleOnboardingPickerSelections({
          campus: settings.preferredCampus,
          primaryDeptId: settings.primaryDeptId,
          interestDeptIds: settings.interestDeptIds,
          tabsConfig: undefined,
        }),
        onboarded: true,
      }
    : undefined;
}

export function restoreOnboardingFromPreferences(prefs: PreferencesDocument): void {
  if (prefs.onboardedAt == null) return;
  const restoredDeptIds = prefs.pickerSelections?.dept ?? [];
  // WHY: '' is the sentinel for a user who skipped the primary department.
  const restoredPrimary = restoredDeptIds[0] || null;
  useSettingsStore.getState().restoreOnboardingFromRemote({
    primaryDeptId: restoredPrimary,
    interestDeptIds: restoredDeptIds.slice(1, 5),
  });
}

/** WHY: bootstrap's retrying attach, handed in because no feature imports bootstrap/. */
type Listen<T> = (
  subscribe: (onNext: (value: T) => void, onError: (err: unknown) => void) => () => void,
  label: string,
  onNext: (value: T) => void,
) => () => void;

export function listenToBookmarks(uid: string, listen: Listen<Record<string, BookmarkEntry>>): () => void {
  return listen(
    (next, fail) => onBookmarksChanged(uid, next, fail),
    'bookmarks/onSnapshot',
    (entries) => useBookmarkStore.getState().setEntries(entries),
  );
}
