/**
 * QUIRK(gorhom-bottom-sheet): below its top detent every scroll event puts the list back to the lock offset,
 * so a hold writes its offset into that capture and the library stays as it is. Runs on the UI thread.
 */

export interface ScrollLockContext {
  shouldLockInitialPosition?: boolean;
  initialContentOffsetY?: number;
}

export function holdLockAt(context: ScrollLockContext, y: number): void {
  'worklet';
  context.shouldLockInitialPosition = true;
  context.initialContentOffsetY = y;
}
