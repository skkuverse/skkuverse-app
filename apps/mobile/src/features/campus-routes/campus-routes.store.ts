// SEE: docs/explanation/shared-map.md
// WHY: the page restores from here when a place's close returns to it; in memory only, since a cold start opens fresh.

export interface RouteViewSnapshot {
  expanded: readonly string[];
  scrollY: number;
}

const snapshots = new Map<string, RouteViewSnapshot>();

export const routeViewSnapshots = {
  save: (routeId: string, snapshot: RouteViewSnapshot): void => {
    snapshots.set(routeId, snapshot);
  },
  read: (routeId: string): RouteViewSnapshot | null => snapshots.get(routeId) ?? null,
};
