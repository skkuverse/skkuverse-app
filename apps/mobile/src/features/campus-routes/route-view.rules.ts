export interface ScrollRestoreInput {
  pending: number;
  contentHeight: number;
  viewportHeight: number;
  settled: boolean;
}

// WHY: wait until the content is tall enough, so a size reported part-way through layout does not spend the offset;
// once settled and still short (the answer changed while away), settle at the furthest the content allows.
export function decideScrollRestore({ pending, contentHeight, viewportHeight, settled }: ScrollRestoreInput): {
  scrollTo: number | null;
  done: boolean;
} {
  if (pending <= 0) return { scrollTo: null, done: true };
  if (viewportHeight <= 0) return { scrollTo: null, done: false };
  if (contentHeight >= pending + viewportHeight) return { scrollTo: pending, done: true };
  if (!settled) return { scrollTo: null, done: false };
  return { scrollTo: Math.max(0, contentHeight - viewportHeight), done: true };
}

export function rideKey(optionId: string, index: number): string {
  return `${optionId}:${index}`;
}
