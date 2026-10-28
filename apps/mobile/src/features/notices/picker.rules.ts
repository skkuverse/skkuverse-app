import type { Campus } from '@skkuverse/shared';
import type { ExcludeReasonKey, NoticeTab } from './notices.types';

/**
 * WHY: the sources[0] fallback stays so a first-time user never sees a blank tab, but for 'dept' and
 * 'general' it shows a department the user never chose after a failed save, so callers pass `onFallback`.
 * Campus defaults are an onboarding seed only, never merged here.
 */
export function resolvePickerSelection(
  tab: NoticeTab,
  stored: string[] | undefined,
  /** WHY: injected rather than imported, so this module stays dependency-free. */
  onFallback?: () => void,
): string[] {
  if (!tab.picker) return [];
  const picker = tab.picker;
  const validIds = new Set(picker.sources.map((s) => s.id));

  if (stored && stored.length > 0) {
    const valid = stored.filter((id) => validIds.has(id));
    if (valid.length > 0) return valid;
  }

  if (picker.defaultIds.length > 0) {
    return picker.defaultIds.filter((id) => validIds.has(id));
  }

  if (picker.sources.length === 0) return [];
  onFallback?.();
  return [picker.sources[0].id];
}

/** WHY: common defaults come first, so the server's order holds (lib-all stays at the top). */
export function computeOnboardingPickerSeed(
  tab: NoticeTab,
  campus: Campus,
): string[] {
  if (tab.tabMode !== 'picker' || !tab.picker) return [];
  const picker = tab.picker;
  const validIds = new Set(picker.sources.map((s) => s.id));

  const common = picker.defaultIds.filter((id) => validIds.has(id));
  const campusAdds = (picker.campusDefaultIds[campus] ?? []).filter((id) =>
    validIds.has(id),
  );

  const seen = new Set<string>();
  const merged: string[] = [];
  for (const id of [...common, ...campusAdds]) {
    if (!seen.has(id)) {
      seen.add(id);
      merged.push(id);
    }
  }
  return merged.slice(0, picker.maxSelection);
}

const KNOWN_EXCLUDE_REASONS: ReadonlySet<ExcludeReasonKey> = new Set<ExcludeReasonKey>([
  'loginRequired',
  'noWebsite',
  'externalSystem',
  'accessRestricted',
  'temporarilyUnavailable',
]);

export function hasBundledExcludeReasonCopy(key: string | null): key is ExcludeReasonKey {
  return key !== null && KNOWN_EXCLUDE_REASONS.has(key as ExcludeReasonKey);
}
