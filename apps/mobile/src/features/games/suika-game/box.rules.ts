export interface BoxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BoxInput {
  /** WHY: in points from the screen's top left. */
  reported: BoxRect | null;
  width: number;
  height: number;
}

/** WHY: a page that has reported no box yet gets the whole screen. */
export function boxOf({ reported, width, height }: BoxInput): BoxRect {
  return reported ?? { x: 0, y: 0, width, height };
}
