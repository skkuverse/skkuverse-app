import type { ActionType, BannerImage } from '@skkuverse/shared';

export interface SduiButtonItem {
  id: string;
  title: string;
  emoji: string;
  actionType: ActionType;
  actionValue: string;
  webviewTitle?: string;
  webviewColor?: string;
}

export interface SduiButtonGrid {
  type: 'button_grid';
  id: string;
  columns: number;
  items: SduiButtonItem[];
}

export interface SduiSectionTitle {
  type: 'section_title';
  id: string;
  title: string;
}

export interface SduiNotice {
  type: 'notice';
  id: string;
  title: string;
  actionType: ActionType;
  actionValue: string;
}

export interface SduiBanner {
  type: 'banner';
  id: string;
  imageUrl: string;
  actionType: ActionType;
  actionValue: string;
}

/** WHY: images only; the campus feed has no built-in banner for a `default` item to stand for, so the parser drops it. */
export interface SduiBannerCarousel {
  type: 'banner_carousel';
  id: string;
  aspectRatio: number;
  autoRotateSec: number;
  items: BannerImage[];
}

export interface SduiSpacer {
  type: 'spacer';
  id: string;
  height: number;
}

export interface SduiUnknown {
  type: 'unknown';
  id: string;
  originalType: string;
}

/** WHY: a section type is a new interaction, never a new arrangement of existing material, so the widget set stays bounded. */
export type SduiSection =
  | SduiButtonGrid
  | SduiSectionTitle
  | SduiNotice
  | SduiBanner
  | SduiBannerCarousel
  | SduiSpacer
  | SduiUnknown;

export interface CampusSectionsResponse {
  sections: SduiSection[];
  minAppVersion: string | null;
}
