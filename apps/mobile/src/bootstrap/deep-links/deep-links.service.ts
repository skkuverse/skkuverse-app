import {
  parseIncomingLink,
  parseMapPlaceRef,
  parseMiniAppTarget,
  resolveInitialTabRouteName,
  useSettingsStore,
} from '@skkuverse/shared';
import { pendingExternalNoticeLink } from '@/features/notices/notices.service';
import { pendingMapChipLink, pendingMapPlaceLink } from '@/features/map/map.service';
import { pendingTransitSheet } from '@/features/transit/transit.service';
import { pendingMiniAppLink } from '@/features/web/web.service';
import { track } from '@/platform/analytics';
import { campaignSrc, type LinkKind } from '@/platform/analytics.rules';
import {
  ALLOWED_PATHS,
  CHIP_ID_RE,
  LINE_ID_RE,
  MAP_PATH_RE,
  MINIAPP_PATH_RE,
  NOTICE_PATH_RE,
  TAB_PATHS,
  TRANSIT_PATH_RE,
} from './deep-links.rules';

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  // WHY: cold and warm starts filter identically, so an untrusted link cannot push an internal route; only bare `/` differs.
  try {
    const { pathname, params } = parseIncomingLink(path);
    const src = campaignSrc(params.get('src'));
    const logLink = (kind: LinkKind, itemId?: string) =>
      track('link_open', { kind, via: 'deeplink', item_id: itemId, src });

    if (pathname === '/') {
      // QUIRK(ios): a redirect-only app/index.tsx would leave a titleless phantom in the long-press back menu.
      if (initial) {
        const lastTab = useSettingsStore.getState().lastTab;
        return `/(tabs)/${resolveInitialTabRouteName(lastTab)}`;
      }
      return '/(tabs)/home';
    }

    // WHY: the tab first and the detail after mount, so back lands on the notices tab, not whichever tab was active.
    const noticeMatch = pathname.match(NOTICE_PATH_RE);
    if (noticeMatch) {
      pendingExternalNoticeLink.set({
        sourceId: noticeMatch[1],
        articleNo: noticeMatch[2],
        source: 'universal_link',
      });
      logLink('notice', `${noticeMatch[1]}/${noticeMatch[2]}`);
      return '/(tabs)/notices';
    }

    const miniAppMatch = pathname.match(MINIAPP_PATH_RE);
    const miniAppTarget = miniAppMatch ? parseMiniAppTarget(miniAppMatch[1]) : null;
    if (miniAppTarget) {
      pendingMiniAppLink.set(miniAppTarget);
      logLink('miniapp', miniAppTarget.id);
      return '/(tabs)/home';
    }

    // WHY: shape-checked, never looked up here; outside the React tree a lookup would block the first navigation.
    if (MAP_PATH_RE.test(pathname)) {
      const chip = params.get('chip');
      const chipId = chip !== null && CHIP_ID_RE.test(chip) ? chip : null;
      if (chipId) pendingMapChipLink.set({ chipId, source: 'deeplink' });
      const ref = parseMapPlaceRef(params.get('place'));
      if (ref) pendingMapPlaceLink.set({ ...ref, tab: 'map' });
      logLink('map_place', params.get('place') ?? (chipId ? `chip:${chipId}` : undefined));
      return '/(tabs)/campus';
    }

    if (TRANSIT_PATH_RE.test(pathname)) {
      const line = params.get('line');
      if (line && LINE_ID_RE.test(line)) {
        pendingTransitSheet.set({ kind: 'line', groupId: line, source: 'deeplink' });
        logLink('transit_line', line);
        return '/(tabs)/transit';
      }
    }

    if (!ALLOWED_PATHS.some((allowed) => pathname === allowed)) {
      logLink('blocked', pathname);
      return '/(tabs)/home';
    }

    logLink('static', pathname);
    if (TAB_PATHS[pathname]) return TAB_PATHS[pathname];
    return pathname;
  } catch {
    return '/(tabs)/home';
  }
}
