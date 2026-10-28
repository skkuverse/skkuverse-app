import type { Campus } from '@skkuverse/shared';

/**
 * WHY: `switch` only moves the toggle, since the camera is already on the other campus; `show` also takes the
 * camera there.
 */
export type CampusSuggestionVariant = 'switch' | 'show';

export interface CampusSuggestion {
  campus: Campus;
  label: string;
  variant: CampusSuggestionVariant;
}

export type DismissedSuggestionKey = `${Campus}:${CampusSuggestionVariant}`;
