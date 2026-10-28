import { ELEMENT_COORDS, type ElementCoord } from './element-coordinates.constants';

export function findElementAtPoint(
  svgX: number,
  svgY: number,
): string | null {
  for (const [id, coord] of Object.entries(ELEMENT_COORDS)) {
    if (isInsideElement(svgX, svgY, coord)) {
      return id;
    }
  }
  return null;
}

function isInsideElement(
  x: number,
  y: number,
  coord: ElementCoord,
): boolean {
  if (coord.type === 'ellipse') {
    const dx = (x - coord.cx) / coord.rx;
    const dy = (y - coord.cy) / coord.ry;
    return dx * dx + dy * dy <= 1;
  }
  return (
    Math.abs(x - coord.cx) <= coord.rx &&
    Math.abs(y - coord.cy) <= coord.ry
  );
}
