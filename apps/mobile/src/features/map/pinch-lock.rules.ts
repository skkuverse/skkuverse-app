/**
 * QUIRK(naver-map): a pinch zooms about the fingers, so the dot slides; with scroll off the SDK zooms about the
 * target, the dot. Decided when the second finger lands and held until every finger is up, since the SDK
 * drops to NoFollow at the start and fixes a gesture's abilities when it begins.
 */

export interface PinchLock {
  pinching: boolean;
  locked: boolean;
}

export const NO_PINCH: PinchLock = { pinching: false, locked: false };

/** WHY: the same object when nothing changed, since this runs on every touch move and the caller re-renders on a new one. */
export function stepPinchLock(s: PinchLock, touches: number, following: boolean): PinchLock {
  if (touches === 0) return s.pinching ? NO_PINCH : s;
  if (touches >= 2 && !s.pinching) return { pinching: true, locked: following };
  return s;
}
