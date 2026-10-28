import type { ActionType } from '../utils/sdui-action.rules';

export interface BannerImage {
  type: 'image';
  id: string;
  imageUrl: string;
  /** WHY: never blank for a screen reader: the id when the server sends no alt. */
  alt: string;
  action?: { actionType: ActionType; actionValue: string };
}

export interface BannerDefault {
  type: 'default';
}

export type BannerItem = BannerImage | BannerDefault;

export interface BannerCarousel {
  type: 'banner_carousel';
  id: string;
  aspectRatio: number;
  /** WHY: 0 turns auto-rotation off. */
  autoRotateSec: number;
  items: BannerItem[];
}
