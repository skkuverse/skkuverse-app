// WHY: a pressed sample is drawn from the component's own recipe and role table, which the sds index does not export, so this is the one file that reads them and breaks at compile time if they move.
import { createRecipe } from '@skkuverse/sds';
/* eslint-disable no-restricted-imports -- the catalog draws from SDS internals on purpose; no screen may */
import { buttonRecipe } from '@skkuverse/sds/src/components/button/buttonRecipe';
import { calloutRecipe } from '@skkuverse/sds/src/components/callout/calloutRecipe';
import { chipRecipe } from '@skkuverse/sds/src/components/chip/chipRecipe';

export { buttonSurfaceToken } from '@skkuverse/sds/src/components/button/buttonRecipe';
export { CALLOUT_ROLES, CALLOUT_TEXT } from '@skkuverse/sds/src/components/callout/calloutRecipe';
export { CHIP_LABEL_TEXT, chipSurface } from '@skkuverse/sds/src/components/chip/chipRecipe';
export { chipFeedback } from '@skkuverse/sds/src/components/chip/chipState';
export { resolvePressFeedback } from '@skkuverse/sds/src/core/pressFeedback';
export { txtSlot } from '@skkuverse/sds/src/components/txt/txtSlot';
/* eslint-enable no-restricted-imports */

export const buttonCatalog = createRecipe(buttonRecipe);
export const chipCatalog = createRecipe(chipRecipe);
export const calloutCatalog = createRecipe(calloutRecipe);

// WHY: mirrors `sizeToTypography` in packages/sds Button.tsx, which is not exported.
export const BUTTON_SIZE_TYPOGRAPHY = {
  xsmall: 't3',
  small: 't5',
  medium: 't8',
  large: 't8',
} as const;

// WHY: mirrors `RUN_SEPARATOR` in packages/sds Callout.tsx.
export const CALLOUT_RUN_SEPARATOR = '  ';
