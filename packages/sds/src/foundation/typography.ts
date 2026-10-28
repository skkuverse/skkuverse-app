import { SdsTypeScale, type SdsTypeScaleKey } from '@skkuverse/shared';

/** WHY: only the weights WantedSans ships a face for (Regular, Medium, Bold; SemiBold draws Medium), so a weight with no face is a type error, not a silent substitute. */
export const fontWeightMap = {
  regular: '400',
  medium: '500',
  semiBold: '600',
  semibold: '600',
  bold: '700',
} as const;

export type FontWeightKeys = keyof typeof fontWeightMap;
export type FontWeight = (typeof fontWeightMap)[FontWeightKeys];

export type TypographyKeys = SdsTypeScaleKey;

export interface TypographyStyle {
  fontSize: number;
  lineHeight: number;
}

export const typographyMap: Record<TypographyKeys, TypographyStyle> = SdsTypeScale;
