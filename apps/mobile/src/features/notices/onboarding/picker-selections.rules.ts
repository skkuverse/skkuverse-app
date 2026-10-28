import {
  type Campus,
} from '@skkuverse/shared';
import { computeOnboardingPickerSeed } from '../picker.rules';
import type { NoticeTabsConfig } from '../notices.types';

/**
 * WHY: general is left out, not an empty list, which settings would read as the user's opt-out; a missing
 * primary is the sentinel '', which the functions' derive filters out.
 */
export function assembleOnboardingPickerSelections(args: {
  campus: Campus;
  primaryDeptId: string | null;
  interestDeptIds: string[];
  tabsConfig: NoticeTabsConfig | undefined;
}): Record<string, string[]> {
  const { campus, primaryDeptId, interestDeptIds, tabsConfig } = args;

  const combined: string[] = [];
  const seen = new Set<string>();
  if (primaryDeptId === null) {
    combined.push('');
  } else {
    combined.push(primaryDeptId);
    seen.add(primaryDeptId);
  }
  for (const id of interestDeptIds) {
    if (!seen.has(id)) {
      seen.add(id);
      combined.push(id);
    }
  }
  // WHY: the server-side functions kept outside this repository use 'dept' too, so a rename is one coordinated change.
  const deptTab = tabsConfig?.tabs.find((tab) => tab.key === 'dept');
  const maxPicks = deptTab?.picker?.maxSelection ?? combined.length;
  const seedDeptIds = combined.slice(0, maxPicks);

  const pickerSelections: Record<string, string[]> = { dept: seedDeptIds };

  for (const seedKey of ['library', 'dorm']) {
    const tab = tabsConfig?.tabs.find((t) => t.key === seedKey);
    if (tab) {
      const seed = computeOnboardingPickerSeed(tab, campus);
      if (seed.length > 0) {
        pickerSelections[seedKey] = seed;
      }
    }
  }

  return pickerSelections;
}
