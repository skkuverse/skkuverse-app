// QUIRK(whatwg-url): a non-ASCII path arrives percent-encoded, and parseIncomingLink lowercases a
// first segment's hex, so `//` and `///` spell it differently; keep every entry ASCII.
export const ALLOWED_PATHS = ['/home', '/campus', '/transit', '/map/hssc', '/search'];

export const TAB_PATHS: Record<string, string> = {
  '/home': '/(tabs)/home',
  '/campus': '/(tabs)/campus',
  '/transit': '/(tabs)/transit',
};

// WHY: anchored, so `/notices/cse/5847/extra` falls to home; a slug-only sourceId keeps an untrusted
// link's free text out of the detail route it opens.
export const NOTICE_PATH_RE = /^\/notices\/([a-z0-9-]+)\/(\d+)$/;

// SEE: docs/reference/deep-link.md ("Mini app links are looked up after mount")
export const MINIAPP_PATH_RE = /^\/m\/(.+)$/;

// WHY: the `$` anchor keeps `/map/hssc` out, so it falls through to the whitelist and the floor map.
// WHY: intercepted, not whitelisted; a `/map` in ALLOWED_PATHS would be a second, unreachable path.
export const MAP_PATH_RE = /^\/map$/;

// WHY: shape only, a short slug, so an untrusted link or push carries no free text to the map tab;
// whether the config serves the chip is the map tab's to find out.
export const CHIP_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

// WHY: intercepted only with a well-formed `line`; a bare `/transit` falls through to the whitelist as the static tab link.
export const TRANSIT_PATH_RE = /^\/transit$/;

// WHY: shape only, like the mini-app slug; whether the group exists is the transit tab's to find out once mounted.
export const LINE_ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
