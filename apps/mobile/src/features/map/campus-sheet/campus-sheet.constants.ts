/**
 * WHY: empty on purpose. A stale promo is worse than none, and a fallback that disagrees with the server
 * surfaces only when nobody is looking (skkuverse#46). A dead API and an empty feed render the same card.
 */

import type { CampusSectionsResponse } from './campus-sheet.types';

export const DEFAULT_CAMPUS_SECTIONS: CampusSectionsResponse = {
  sections: [],
  minAppVersion: null,
};
