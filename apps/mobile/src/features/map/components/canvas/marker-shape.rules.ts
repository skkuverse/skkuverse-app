import type { MarkerShape } from '../../map-config.types';
import { DOT_CANVAS_RATIO, DOT_DIAMETER, PIN_HEIGHT, PIN_WIDTH } from './marker.constants';
/**
 * WHY: the anchor has to move with the shape; a teardrop hangs by its tip and a disc by its centre, so
 * swapping the image alone slides the selected marker off its coordinate.
 */


/** WHY: not `'pin'`, so a server predating `style.shape` gets the dot rather than the old look forever. */
const DEFAULT_SHAPE: MarkerShape = 'dotThenPin';
export interface MarkerGeometry {
  kind: 'pin' | 'dot';
  /** WHY: for a dot this is the padded canvas, not the disc. */
  width: number;
  height: number;
  anchorY: number;
}

type StyleGeometry = {
  width?: number;
  height?: number;
  size?: number;
};

function kindOf(shape: MarkerShape | undefined, isSelected: boolean): 'pin' | 'dot' {
  switch (shape ?? DEFAULT_SHAPE) {
    case 'pin':
      return 'pin';
    case 'dot':
      return 'dot';
    case 'dotThenPin':
      return isSelected ? 'pin' : 'dot';
  }
}

export function resolveMarkerGeometry(
  shape: MarkerShape | undefined,
  isSelected: boolean,
  style: StyleGeometry | undefined,
): MarkerGeometry {
  const pinWidth = style?.width ?? PIN_WIDTH;
  const kind = kindOf(shape, isSelected);

  if (kind === 'pin') {
    return {
      kind,
      width: pinWidth,
      height: style?.height ?? PIN_HEIGHT,
      anchorY: 1,
    };
  }

  // WHY: a selected disc borrows the pin's width, so one wire field sizes the selected marker in either shape.
  const visible = isSelected ? pinWidth : (style?.size ?? DOT_DIAMETER);
  const canvas = visible * DOT_CANVAS_RATIO;
  return { kind, width: canvas, height: canvas, anchorY: 0.5 };
}
