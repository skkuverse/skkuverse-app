// CONTRACT(skkuverse-server): skkuverse-server/src/ui/ui.wire.ts builds `banner_carousel` for
// both GET /ui/home and GET /ui/home/campus, so its schema is shared (ADR 0020 D2).
import { z } from 'zod';
import { parseActionType } from '../utils/sdui-action.rules';
import { openUnionArray, optionalText, parsedBy, text } from './tolerant';
import type { BannerCarousel, BannerDefault, BannerImage } from './banner-carousel.types';

export type { BannerCarousel, BannerDefault, BannerImage, BannerItem } from './banner-carousel.types';

export const DEFAULT_BANNER_ASPECT_RATIO = 2.25;
export const DEFAULT_AUTO_ROTATE_SEC = 5;

// WHY: the server validates the same ranges, so a value outside them is a bug;
// it falls back to the default rather than a clamp that would look deliberate.
const ASPECT_RATIO_RANGE = [1, 6] as const;
const AUTO_ROTATE_SEC_RANGE = [2, 30] as const;

function inRange(v: unknown, [min, max]: readonly [number, number]): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
}

const imageItemSchema = z
  .object({
    type: z.literal('image'),
    id: text,
    imageUrl: text.regex(/^https:\/\//),
    alt: optionalText,
    // WHY: sdui's action parser is not migrated yet, so it is wrapped (ADR 0020 D6).
    actionType: parsedBy(parseActionType),
    actionValue: optionalText,
  })
  .transform(
    ({ id, imageUrl, alt, actionType, actionValue }) =>
      ({
        type: 'image',
        id,
        imageUrl,
        alt: alt ?? id,
        // WHY: an action this build cannot read makes the banner inert, not hidden.
        action: actionType !== 'unknown' && actionValue ? { actionType, actionValue } : undefined,
      }) satisfies BannerImage,
  );

const defaultItemSchema = z
  .object({ type: z.literal('default') })
  .transform(() => ({ type: 'default' }) satisfies BannerDefault);

export const bannerCarouselSchema = z
  .object({
    id: text,
    aspectRatio: parsedBy((v) => (inRange(v, ASPECT_RATIO_RANGE) ? v : DEFAULT_BANNER_ASPECT_RATIO)),
    autoRotateSec: parsedBy((v) => (v === 0 ? 0 : inRange(v, AUTO_ROTATE_SEC_RANGE) ? v : DEFAULT_AUTO_ROTATE_SEC)),
    items: parsedBy((v) => (Array.isArray(v) ? v : [])).pipe(
      openUnionArray('type', { image: imageItemSchema, default: defaultItemSchema }, 'banner_carousel.items'),
    ),
  })
  .transform(
    ({ id, aspectRatio, autoRotateSec, items }) =>
      ({ type: 'banner_carousel', id, aspectRatio, autoRotateSec, items }) satisfies BannerCarousel,
  );

export function parseBannerCarousel(raw: unknown): BannerCarousel | null {
  const result = bannerCarouselSchema.safeParse(raw);
  return result.success ? result.data : null;
}
