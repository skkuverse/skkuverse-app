/**
 * WHY: the list hands over the array on screen at the moment of the tap, since the detail cannot rebuild
 * the list's query key; and no index is stored, so the detail re-finds itself on every hop.
 */
export interface NoticeSibling {
  /** WHY: the route's sourceId, which on a multi-source tab can differ from the item's. */
  sourceId: string;
  articleNo: number;
  title: string;
}

export interface NoticeSiblingsResult {
  prev: NoticeSibling | null;
  next: NoticeSibling | null;
}

/**
 * WHY: "previous" is the older notice, one row down in a newest-first list (i+1); mapping it to i-1
 * gave the newest notice a "next" and no "previous".
 */
export function findSiblings(
  items: NoticeSibling[],
  sourceId: string,
  articleNo: number,
): NoticeSiblingsResult {
  const i = items.findIndex(
    (it) => it.articleNo === articleNo && it.sourceId === sourceId,
  );
  if (i === -1) return { prev: null, next: null };
  return {
    prev: i < items.length - 1 ? items[i + 1] : null,
    next: i > 0 ? items[i - 1] : null,
  };
}
