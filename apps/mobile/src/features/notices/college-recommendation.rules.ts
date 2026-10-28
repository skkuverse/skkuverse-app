import type { TabSource } from './notices.types';

export interface CollegeMates {
  recommended: TabSource[];
  others: TabSource[];
}

export function recommendCollegeMates(
  primary: TabSource | null,
  all: readonly TabSource[],
): CollegeMates {
  if (!primary || primary.college == null) {
    return { recommended: [], others: [...all] };
  }
  const recommended: TabSource[] = [];
  const others: TabSource[] = [];
  for (const source of all) {
    if (source.id === primary.id) continue;
    if (source.college != null && source.college === primary.college) {
      recommended.push(source);
    } else {
      others.push(source);
    }
  }
  return { recommended, others };
}

/**
 * WHY: the umbrella's name contains the college's name, which leaves out sibling departments, and it must
 * be available itself: an unsupported source is never offered an unsupported alternative.
 */
export function findCollegeUmbrella(
  primary: TabSource,
  all: readonly TabSource[],
): TabSource | null {
  if (primary.college == null) return null;
  const college = primary.college;
  return (
    all.find(
      (s) =>
        s.id !== primary.id &&
        s.college === college &&
        s.noticeAvailable &&
        s.name.includes(college),
    ) ?? null
  );
}
