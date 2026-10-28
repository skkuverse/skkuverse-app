/** WHY: skeletonShape.test.mts loads this file under plain Node, so it imports types only. */
import type { SdsRadius } from '@skkuverse/shared';

export type SkeletonShape = 'text' | 'card' | 'avatar';

export const SKELETON_SHAPE_RADIUS = {
  text: 'r2',
  card: 'r4',
  avatar: 'full',
} as const satisfies Record<SkeletonShape, keyof typeof SdsRadius>;

export const SKELETON_DEFAULT_RADIUS = 'r1_5' satisfies keyof typeof SdsRadius;

export function skeletonRadius(
  radius: typeof SdsRadius,
  shape: SkeletonShape | undefined,
  borderRadius: number | undefined,
): number {
  if (shape !== undefined) return radius[SKELETON_SHAPE_RADIUS[shape]];
  return borderRadius ?? radius[SKELETON_DEFAULT_RADIUS];
}

export function skeletonWidth(
  shape: SkeletonShape | undefined,
  width: number | string | undefined,
  height: number,
): number | string | undefined {
  if (width !== undefined) return width;
  return shape === 'avatar' ? height : undefined;
}
