import type { TabSource } from './notices.types';
/** WHY: hiding unsupported sources made a department vanish from search and read as a broken app. */


export interface FilterPickerSourcesOptions {
  showUnsupported: boolean;
}

export function filterPickerSources(
  sources: readonly TabSource[],
  opts: FilterPickerSourcesOptions,
): TabSource[] {
  if (opts.showUnsupported) return [...sources];
  return sources.filter((s) => s.noticeAvailable);
}

/** WHY: checks both sides of the `noticeAvailable` and `excludeReason` biconditional, to make intent obvious. */
export function isUnsupportedSource(source: TabSource): boolean {
  return !source.noticeAvailable && source.excludeReason !== null;
}
