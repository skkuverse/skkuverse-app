// CONTRACT(skkuverse-server): skkuverse-server/src/miniapps/ serves the registry and the feed, with
// fixtures under contracts/produced/fixtures/. SEE: docs/explanation/miniapp-shell.md
import { z } from 'zod';
import { DEFAULT_SHELL, mergeShell, parseShellFields } from '@skkuverse/miniapp/protocol';
import { logoSchema, optionalText, parsedBy, text, tolerantArray } from '@skkuverse/shared';
import type {
  MiniAppDetail,
  MiniAppFeedEntry,
  MiniAppIndex,
  MiniAppIndexEntry,
  MiniAppLink,
  MiniAppNoticeBanner,
  MiniAppShell,
} from './web.types';

const DEFAULT_REGISTRY_VERSION = 1;

// WHY: `id` is a join key, a deep-link path and a cache key, so it must stay a plain slug.
const slug = text.regex(/^[a-z0-9-]+$/);
// WHY: a start URL or link goes straight to a WebView, where `javascript:` would run inside the shell.
const httpUrl = z.string().regex(/^https?:\/\//);
// WHY: a logo is cosmetic, so a bad one costs the tile its image, never the tile.
const optionalLogo = logoSchema.nullable().catch(null);
const listOrEmpty = parsedBy((raw) => (Array.isArray(raw) ? raw : []));

const indexEntrySchema = z
  .object({
    position: z.number(),
    entry: z.object({
      id: slug,
      name: text,
      shortName: optionalText,
      order: z.unknown(),
      homeLogo: optionalLogo,
      shellLogo: optionalLogo,
      hidden: z.literal(true).optional().catch(undefined),
    }),
  })
  .transform(
    ({ position, entry: { id, name, shortName, order, homeLogo, shellLogo, hidden } }) =>
      ({
        id,
        name,
        shortName,
        order: typeof order === 'number' ? order : position,
        homeLogo,
        shellLogo,
        ...(hidden ? { hidden } : {}),
      }) satisfies MiniAppIndexEntry,
  );

function withPositions(raw: unknown): unknown[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.map((entry: unknown, position) => ({ position, entry }));
}

/**
 * WHY: an entry without a slug id or a name drops alone; a missing `order` takes its place as sent, before any
 * drop.
 */
export const miniAppIndexSchema = z.object({
  version: z.number().catch(DEFAULT_REGISTRY_VERSION),
  miniApps: parsedBy(withPositions)
    .pipe(tolerantArray(indexEntrySchema, 'miniapps.index'))
    .transform((entries) => entries.sort((a, b) => a.order - b.order)),
}) satisfies z.ZodType<MiniAppIndex>;

const linkSchema = z.object({ url: httpUrl, label: optionalText }) satisfies z.ZodType<MiniAppLink>;

// WHY: a banner with a blank subtitle reads as a bug, so a half-filled one is absent.
const noticeBannerSchema = z.object({ title: text, subtitle: text }) satisfies z.ZodType<MiniAppNoticeBanner>;

// WHY: each field falls back to the default on its own, so one bad field never costs the shell.
// `bar: 'hide'` is the protocol's `none` under its pre-protocol name, which an older server sends.
function toShell(raw: unknown): MiniAppShell {
  const renamed = typeof raw === 'object' && raw !== null && 'bar' in raw && raw.bar === 'hide' ? { ...raw, bar: 'none' } : raw;
  return mergeShell(DEFAULT_SHELL, parseShellFields(renamed));
}

/** WHY: unusable without a slug id and an `http(s)` start URL, which is all the shell loads. */
export const miniAppDetailSchema = z.object({
  version: z.number().catch(DEFAULT_REGISTRY_VERSION),
  id: slug,
  startUrl: httpUrl,
  // WHY: the badge asserts identity, so only a literal `true` earns it.
  verified: z.boolean().catch(false),
  description: optionalText,
  relatedLinks: listOrEmpty.pipe(tolerantArray(linkSchema, 'miniapps.detail.relatedLinks')),
  noticeBanner: noticeBannerSchema.optional().catch(undefined),
  shell: parsedBy(toShell),
}) satisfies z.ZodType<MiniAppDetail>;

const feedEntrySchema = z.object({
  id: text,
  title: text,
  body: text,
  sentAt: text.refine((value) => !Number.isNaN(Date.parse(value))),
  actionType: optionalText,
  actionValue: optionalText,
}) satisfies z.ZodType<MiniAppFeedEntry>;

/** WHY: a body that is not a list reads as an empty feed. */
export const miniAppFeedSchema = listOrEmpty.pipe(tolerantArray(feedEntrySchema, 'miniapps.feed'));
