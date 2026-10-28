// CONTRACT(skkuverse-server): skkuverse-server/src/ui/home/ writes this layout and publishes its fixtures as ui-home.homeLayout.
import { z } from 'zod';
import {
  bannerCarouselSchema,
  logoSchema,
  openUnionArray,
  optionalText,
  parseActionType,
  text,
} from '@skkuverse/shared';
import { DEFAULT_MINIAPP_FEED_LIMIT, HOME_LAYOUT_VERSION, MINIAPP_FEED_LIMIT_MAX } from './home.constants';
import type { HomeLayout, HomeLayoutLinkTile, HomeLayoutMiniAppFeed, HomeLayoutTileGrid } from './home.types';

// WHY: a link tile whose action this build cannot run is dropped; unlike a banner, it has nothing left to show.
const knownActionTypeSchema = z
  .unknown()
  .transform(parseActionType)
  .refine((type) => type !== 'unknown');

const homeTilesSchema = openUnionArray(
  'kind',
  {
    miniapp: z.object({ kind: z.literal('miniapp'), id: text }),
    game: z.object({ kind: z.literal('game'), id: text }),
    link: z
      .object({
        id: text,
        title: text,
        icon: logoSchema,
        actionType: knownActionTypeSchema,
        actionValue: text,
      })
      .transform(
        ({ id, title, icon, actionType, actionValue }) =>
          ({ kind: 'link', id, title, icon, action: { actionType, actionValue } }) satisfies HomeLayoutLinkTile,
      ),
  },
  'home.tiles',
);

const homeSectionsSchema = openUnionArray(
  'type',
  {
    banner_carousel: bannerCarouselSchema,
    miniapp_feed: z
      .object({
        id: text,
        miniAppId: text,
        title: optionalText,
        limit: z.number().int().min(1).max(MINIAPP_FEED_LIMIT_MAX).catch(DEFAULT_MINIAPP_FEED_LIMIT),
      })
      .transform(
        ({ id, miniAppId, title, limit }) =>
          ({ type: 'miniapp_feed', id, miniAppId, title, limit }) satisfies HomeLayoutMiniAppFeed,
      ),
    tile_grid: z
      .object({ id: text, title: optionalText, tiles: homeTilesSchema.refine((tiles) => tiles.length > 0) })
      .transform(({ id, title, tiles }) => ({ type: 'tile_grid', id, title, tiles }) satisfies HomeLayoutTileGrid),
  },
  'home.sections',
);

export const homeLayoutSchema = z.object({
  version: z.number().catch(HOME_LAYOUT_VERSION),
  sections: homeSectionsSchema,
}) satisfies z.ZodType<HomeLayout>;
