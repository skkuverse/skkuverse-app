// The rules of the local `arch` ESLint plugin (scripts/eslint/plugin-arch.cjs),
// through ESLint's RuleTester under node:test, parsed as TypeScript with JSX
// the way the root config parses app code. Each case names its file, since
// every rule decides by where the importing file and its target live.
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const plugin = require('./plugin-arch.cjs');

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const { repoRoot } = plugin._internal;
const at = (path) => join(repoRoot, path);
const HOME = at('apps/mobile/src/features/home/HomeScreen.tsx');

ruleTester.run('arch/feature-door', plugin.rules['feature-door'], {
  valid: [
    // Another feature's view-model hook, root component or service.
    { filename: HOME, code: "import { useGames } from '@/features/games/useGames';" },
    { filename: HOME, code: "import { HallOfFameSection } from '@/features/games/HallOfFameSection';" },
    { filename: HOME, code: "import { submit } from '@/features/games/games.service';" },
    // Constants, and the same kinds at a sub-feature's root.
    { filename: HOME, code: "import { NATIVE_GAME_IDS } from '@/features/games/games.constants';" },
    { filename: HOME, code: "import { HomeHallOfFame } from '@/features/games/leaderboard/HomeHallOfFame';" },
    { filename: HOME, code: "import { useLeaderboard } from '@/features/games/leaderboard/useLeaderboard';" },
    { filename: HOME, code: "import { submitBest } from '@/features/games/play/play.service';" },
    // Types never cross a runtime boundary.
    { filename: HOME, code: "import type { Game } from '@/features/games/games.types';" },
    { filename: HOME, code: "import { type Game } from '@/features/games/games.types';" },
    // The feature's own private files.
    { filename: HOME, code: "import { homeLayoutQueryOptions } from './home.client';" },
    { filename: HOME, code: "import { Banner } from './components/Banner';" },
    // Shared components go through the same door.
    { filename: at('apps/mobile/src/components/LoopingPager.tsx'), code: "import { useGames } from '@/features/games/useGames';" },
    { filename: at('apps/mobile/src/components/previews/Preview.tsx'), code: "import { HomeHallOfFame } from '../../features/games/leaderboard/HomeHallOfFame';" },
    // bootstrap/ goes through the same door (D2: it stays, so nothing empties it).
    { filename: at('apps/mobile/src/bootstrap/SharedMapShell.tsx'), code: "import { backOnMapTab } from '@/features/map/map.service';" },
    { filename: at('apps/mobile/src/bootstrap/tab-bar.rules.ts'), code: "import { MAP_TAB_OF_ROUTE } from '@/features/map/map-tabs.constants';" },
    { filename: at('apps/mobile/src/bootstrap/tab-bar.rules.ts'), code: "import type { MapTaskState } from '@/features/map/sheet-stack.types';" },
  ],
  invalid: [
    {
      filename: HOME,
      code: "import { Card } from '@/features/games/components/Card';",
      errors: [{ messageId: 'private' }],
    },
    {
      filename: HOME,
      code: "import { Row } from '@/features/games/leaderboard/components/Row';",
      errors: [{ messageId: 'private' }],
    },
    {
      filename: HOME,
      code: "import { usePinch } from '@/features/games/components/usePinch';",
      errors: [{ messageId: 'private' }],
    },
    // A topic-named pure helper in components/ stays private with its components.
    {
      filename: HOME,
      code: "import { cardLayout } from '@/features/games/components/card.rules';",
      errors: [{ messageId: 'private' }],
    },
    {
      filename: HOME,
      code: "import { CARD_WIDTH } from '@/features/games/leaderboard/components/card.constants';",
      errors: [{ messageId: 'private' }],
    },
    {
      filename: HOME,
      code: "import { readBoard } from '@/features/games/leaderboard/leaderboard.repository';",
      errors: [{ messageId: 'private' }],
    },
    {
      filename: HOME,
      code: "import { Deep } from '@/features/games/play/result/Deep';",
      errors: [{ messageId: 'private' }],
    },
    {
      filename: HOME,
      code: "import { parse } from '../games/games.schema';",
      errors: [{ messageId: 'private' }],
    },
    {
      filename: HOME,
      code: "export { parse } from '@/features/games/games.schema';",
      errors: [{ messageId: 'private' }],
    },    {
      filename: at('apps/mobile/src/components/LoopingPager.tsx'),
      code: "import { Card } from '@/features/games/components/Card';",
      errors: [{ messageId: 'private' }],
    },
    {
      filename: at('apps/mobile/src/components/previews/Preview.tsx'),
      code: "import { parse } from '../../features/games/games.schema';",
      errors: [{ messageId: 'private' }],
    },
    // bootstrap/, dev/ and platform/ are checked like any app file.
    {
      filename: at('apps/mobile/src/bootstrap/SharedMapShell.tsx'),
      code: "import { useMapStore } from '@/features/map/map.store';",
      errors: [{ messageId: 'private' }],
    },
    {
      filename: at('apps/mobile/src/bootstrap/tab-bar.rules.ts'),
      code: "import { decideBack } from '@/features/map/map-task.rules';",
      errors: [{ messageId: 'private' }],
    },
    {
      filename: at('apps/mobile/src/dev/sds-states/SdsStatesScreen.tsx'),
      code: "import { Card } from '@/features/games/components/Card';",
      errors: [{ messageId: 'private' }],
    },
  ],
});

const ROUTE = at('apps/mobile/app/(tabs)/home/index.tsx');

ruleTester.run('arch/banned-folder-door', plugin.rules['banned-folder-door'], {
  valid: [
    // A sub-feature's root is a door.
    { filename: HOME, code: "import { useLeaderboard } from '@/features/games/leaderboard/useLeaderboard';" },
    { filename: ROUTE, code: "import { ScheduleScreen } from '@/features/bus/schedule/ScheduleScreen';" },
    // The feature's own banned folder is its own business, and types never cross a runtime boundary.
    { filename: at('apps/mobile/src/features/notifications/NotificationsScreen.tsx'), code: "import { usePush } from './hooks/usePush';" },
    { filename: HOME, code: "import type { Push } from '@/features/notifications/hooks/usePush';" },
    // A private file in a banned folder is feature-door's report, not this rule's.
    { filename: HOME, code: "import { x } from '@/features/notices/utils/notice.rules';" },
  ],
  invalid: [
    {
      filename: at('apps/mobile/src/bootstrap/InitGate.tsx'),
      code: "import { usePush } from '@/features/notifications/hooks/usePush';",
      errors: [{ messageId: 'bannedFolder' }],
    },
    {
      filename: HOME,
      code: "import { useMiniAppPush } from '@/features/notifications/hooks/useMiniAppPush';",
      errors: [{ messageId: 'bannedFolder' }],
    },
    {
      filename: HOME,
      code: "import { Card } from '../notices/utils/Card';",
      errors: [{ messageId: 'bannedFolder' }],
    },
    {
      filename: HOME,
      code: "import { NOTICE_LIMIT } from '@/features/notices/store/notices.constants';",
      errors: [{ messageId: 'bannedFolder' }],
    },
    {
      filename: ROUTE,
      code: "import { useBookmarks } from '@/features/notices/hooks/useBookmarks';",
      errors: [{ messageId: 'bannedFolder' }],
    },
    {
      filename: at('apps/mobile/src/components/LoopingPager.tsx'),
      code: "import { useMinuteTicker } from '@/features/bus/hooks/useMinuteTicker';",
      errors: [{ messageId: 'bannedFolder' }],
    },
  ],
});

// WHY: a door-shaped file in a banned folder is banned-folder-door's report, so the door rules
// stay silent on it rather than count it twice.
ruleTester.run('arch/feature-door: banned folders', plugin.rules['feature-door'], {
  valid: [{ filename: HOME, code: "import { useMiniAppPush } from '@/features/notifications/hooks/useMiniAppPush';" }],
  invalid: [],
});
ruleTester.run('arch/layer-imports: banned folders', plugin.rules['layer-imports'], {
  valid: [{ filename: ROUTE, code: "import { useBookmarks } from '@/features/notices/hooks/useBookmarks';" }],
  invalid: [],
});

const RULES = at('apps/mobile/src/features/home/home.rules.ts');
const TYPES = at('apps/mobile/src/features/home/home.types.ts');

ruleTester.run('arch/layer-imports', plugin.rules['layer-imports'], {
  valid: [
    // A route renders a feature's root-level screen.
    { filename: ROUTE, code: "import { HomeScreen } from '@/features/home/HomeScreen';" },
    // ... or a sub-feature's screen.
    { filename: at('apps/mobile/app/bus/schedule.tsx'), code: "import { ScheduleScreen } from '@/features/bus/schedule/ScheduleScreen';" },
    // A view goes through its ViewModel, and may call a platform wrapper.
    { filename: HOME, code: "import { useHome } from './useHome';" },
    { filename: HOME, code: "import { track } from '@/platform/analytics';" },
    // A data or pure file imports data and pure files.
    { filename: RULES, code: "import { placeHall } from './hall.rules';" },
    { filename: at('apps/mobile/src/features/home/home.client.ts'), code: "import axios from 'axios';" },
    // Types only.
    { filename: HOME, code: "import type { HomeCache } from './home.repository';" },
    // A pure file may name a component's type; a .types.ts names only data and pure types.
    { filename: RULES, code: "import type { BannerProps } from './components/Banner';" },
    { filename: TYPES, code: "import type { NativeGameId } from '@/features/games/games.constants';" },
    { filename: TYPES, code: "import type { BannerCarousel } from '@skkuverse/shared';" },
  ],
  invalid: [
    {
      filename: HOME,
      code: "import { readLayout } from './home.repository';",
      errors: [{ messageId: 'data' }],
    },
    {
      filename: HOME,
      code: "import { homeLayoutQueryOptions } from './home.client';",
      errors: [{ messageId: 'data' }],
    },
    {
      filename: at('apps/mobile/src/features/home/components/Banner.tsx'),
      code: "import firestore from '@react-native-firebase/firestore';",
      errors: [{ messageId: 'data' }],
    },
    {
      filename: ROUTE,
      code: "import { createMMKV } from 'react-native-mmkv';",
      errors: [{ messageId: 'data' }],
    },
    {
      filename: ROUTE,
      code: "import { Banner } from '@/features/home/components/Banner';",
      errors: [{ messageId: 'private' }],
    },
    {
      filename: ROUTE,
      code: "import { Row } from '@/features/bus/schedule/components/Row';",
      errors: [{ messageId: 'private' }],
    },
    {
      filename: RULES,
      code: "import { HomeScreen } from './HomeScreen';",
      errors: [{ messageId: 'ui' }],
    },
    // A .types.ts never imports from a .tsx, even type-only (D4).
    {
      filename: TYPES,
      code: "import type { BannerProps } from './components/Banner';",
      errors: [{ messageId: 'typesUi' }],
    },
    {
      filename: TYPES,
      code: "import { type GridItem } from '@/components/TossfaceButtonGrid';",
      errors: [{ messageId: 'typesUi' }],
    },
    {
      filename: TYPES,
      code: "export type { HomeScreenProps } from './HomeScreen';",
      errors: [{ messageId: 'typesUi' }],
    },
    {
      filename: TYPES,
      code: "import { HomeScreen } from './HomeScreen';",
      errors: [{ messageId: 'ui' }],
    },
  ],
});

const TOPIC_RULES = at('apps/mobile/src/features/home/hall.rules.ts');

ruleTester.run('arch/pure-files', plugin.rules['pure-files'], {
  valid: [
    { filename: RULES, code: "import { z } from 'zod';\nexport const isOpen = (now: Date) => now.getTime() > 0;" },
    { filename: RULES, code: "import { placeHall } from './hall.rules';" },
    { filename: RULES, code: 'const at = new Date(1760000000000);' },
    { filename: RULES, code: "import type { ViewStyle } from 'react-native';" },
    // Outside a pure file, the rule does not apply.
    { filename: at('apps/mobile/src/features/home/home.client.ts'), code: 'const t = Date.now();' },
    // A platform wrapper's pure companion is pure, so a pure file may import it.
    { filename: TOPIC_RULES, code: "import { sanitizeParams } from '@/platform/analytics.rules';" },
  ],
  invalid: [
    { filename: RULES, code: 'const t = Date.now();', errors: [{ messageId: 'clock' }] },
    { filename: RULES, code: 'const t = new Date();', errors: [{ messageId: 'clock' }] },
    { filename: TOPIC_RULES, code: "import { createMMKV } from 'react-native-mmkv';", errors: [{ messageId: 'io' }] },
    { filename: TOPIC_RULES, code: "import { Platform } from 'react-native';", errors: [{ messageId: 'io' }] },
    { filename: TOPIC_RULES, code: "import { readLayout } from './home.repository';", errors: [{ messageId: 'io' }] },
    { filename: TOPIC_RULES, code: "import { track } from '@/platform/analytics';", errors: [{ messageId: 'io' }] },
    // The companion itself is a pure file.
    { filename: at('apps/mobile/src/platform/handoff.rules.ts'), code: 'const t = Date.now();', errors: [{ messageId: 'clock' }] },
    { filename: TOPIC_RULES, code: "import Constants from 'expo-constants';", errors: [{ messageId: 'io' }] },
  ],
});

ruleTester.run('arch/platform-sdk', plugin.rules['platform-sdk'], {
  valid: [
    // The wrapper imports its SDK.
    {
      filename: at('apps/mobile/src/platform/analytics.ts'),
      code: "import { getAnalytics } from '@react-native-firebase/analytics';",
    },
    // A type from the SDK carries no runtime import.
    {
      filename: at('apps/mobile/src/features/map/festivalGate.ts'),
      code: "import type { ReleaseTransitionKind } from '@hot-updater/react-native';",
    },
    // Another Firebase SDK is not one of the listed ones.
    {
      filename: at('apps/mobile/src/features/notifications/useSync.ts'),
      code: "import { getFirestore } from '@react-native-firebase/firestore';",
    },
    // The notifications wrapper imports its SDK, and the background registration's.
    {
      filename: at('apps/mobile/src/platform/notifications.ts'),
      code: "import { setBadgeCountAsync } from 'expo-notifications';\nimport { setBackgroundMessageHandler } from '@react-native-firebase/messaging';",
    },
    // The haptics wrapper imports its SDK.
    {
      filename: at('apps/mobile/src/platform/haptics.ts'),
      code: "import * as Haptics from 'expo-haptics';",
    },
    // The location wrapper imports its SDK.
    {
      filename: at('apps/mobile/src/platform/location.ts'),
      code: "import * as Location from 'expo-location';",
    },
  ],
  invalid: [
    {
      filename: at('apps/mobile/src/features/notifications/push-log.ts'),
      code: "import { log } from '@react-native-firebase/crashlytics';",
      errors: [{ messageId: 'sdk', data: { source: '@react-native-firebase/crashlytics', wrapper: 'platform/crashlytics.ts' } }],
    },
    {
      filename: at('apps/mobile/src/features/map/festivalGate.ts'),
      code: "import { HotUpdater } from '@hot-updater/react-native';",
      errors: [{ messageId: 'sdk', data: { source: '@hot-updater/react-native', wrapper: 'platform/ota.ts' } }],
    },
    {
      filename: at('apps/mobile/app/settings/index.tsx'),
      code: "import { getToken } from '@react-native-firebase/app-check';",
      errors: [{ messageId: 'sdk', data: { source: '@react-native-firebase/app-check', wrapper: 'platform/app-check.ts' } }],
    },
    {
      filename: at('apps/mobile/index.ts'),
      code: "import { getAnalytics } from '@react-native-firebase/analytics';",
      errors: [{ messageId: 'sdk', data: { source: '@react-native-firebase/analytics', wrapper: 'platform/analytics.ts' } }],
    },
    {
      filename: at('apps/mobile/index.ts'),
      code: "import { setBackgroundMessageHandler } from '@react-native-firebase/messaging';",
      errors: [{ messageId: 'sdk', data: { source: '@react-native-firebase/messaging', wrapper: 'platform/messaging.ts' } }],
    },
    {
      filename: at('apps/mobile/src/bootstrap/notifications/badge.ts'),
      code: "import { setBadgeCountAsync } from 'expo-notifications';",
      errors: [{ messageId: 'sdk', data: { source: 'expo-notifications', wrapper: 'platform/notifications.ts' } }],
    },
    {
      filename: at('apps/mobile/src/features/games/host/components/ScoreHeader.tsx'),
      code: "import * as Haptics from 'expo-haptics';",
      errors: [{ messageId: 'sdk', data: { source: 'expo-haptics', wrapper: 'platform/haptics.ts' } }],
    },
    {
      filename: at('apps/mobile/src/features/feedback/useReviewPrompt.ts'),
      code: "import * as StoreReview from 'expo-store-review';",
      errors: [{ messageId: 'sdk', data: { source: 'expo-store-review', wrapper: 'platform/store-review.ts' } }],
    },
    {
      filename: at('apps/mobile/src/features/map/components/useLocationTracking.ts'),
      code: "import * as Location from 'expo-location';",
      errors: [{ messageId: 'sdk', data: { source: 'expo-location', wrapper: 'platform/location.ts' } }],
    },
  ],
});

ruleTester.run('arch/sibling-import', plugin.rules['sibling-import'], {
  valid: [
    // A sub-feature imports its parent's root and its parent's components/, never a sibling's (D2).
    { filename: at('apps/mobile/src/features/transit/subway/components/Line.tsx'), code: "import { PulseAnimation } from '../../components/PulseAnimation';" },
    { filename: at('apps/mobile/src/features/transit/schedule/useSchedule.ts'), code: "import { TRANSIT_TAB } from '../transit.constants';" },
    { filename: at('apps/mobile/src/features/transit/schedule/ScheduleScreen.tsx'), code: "import type { ArrivalLine } from '../realtime/arrival.rules';" },
    { filename: at('apps/mobile/src/features/transit/schedule/ScheduleScreen.tsx'), code: "import { ErrorCard } from './components/ErrorCard';" },
    // A code-type folder is no sub-feature, so an unmigrated feature's hooks/ and utils/ are not siblings.
    { filename: at('apps/mobile/src/features/map/hooks/useCamera.ts'), code: "import { clamp } from '../utils/clamp';" },
    // The feature's root is no sub-feature, and another feature is arch/feature-door's concern.
    { filename: at('apps/mobile/src/features/transit/TransitTabScreen.tsx'), code: "import { BusRealtimeScreen } from './realtime/BusRealtimeScreen';" },
    { filename: at('apps/mobile/src/features/transit/subway/SubwayScreen.tsx'), code: "import { HomeScreen } from '@/features/home/HomeScreen';" },
  ],
  invalid: [
    {
      filename: at('apps/mobile/src/features/transit/subway/SubwayScreen.tsx'),
      code: "import { BusRealtimeScreen } from '../realtime/BusRealtimeScreen';",
      errors: [{ messageId: 'sibling' }],
    },
    {
      filename: at('apps/mobile/src/features/transit/realtime/useBusRealtime.ts'),
      code: "import { ErrorCard } from '@/features/transit/schedule/components/ErrorCard';",
      errors: [{ messageId: 'sibling' }],
    },
  ],
});

const SCHEMA = at('apps/mobile/src/features/home/home.schema.ts');

ruleTester.run('arch/zod-usage', plugin.rules['zod-usage'], {
  valid: [
    { filename: SCHEMA, code: "import { z } from 'zod';\nconst s = z.object({ id: z.string() });" },
    { filename: SCHEMA, code: "import { z } from 'zod';\nconst s = z.looseObject({ id: z.string() });" },
    // Not zod: another library's strict() and coerce stay allowed.
    { filename: SCHEMA, code: 'const s = other.strict();\nconst c = lib.coerce;' },
  ],
  invalid: [
    { filename: SCHEMA, code: "import { z } from 'zod';\nz.strictObject({});", errors: [{ messageId: 'strict' }] },
    { filename: SCHEMA, code: "import { z } from 'zod';\nz.object({}).strict();", errors: [{ messageId: 'strict' }] },
    { filename: SCHEMA, code: "import { z } from 'zod';\nz.coerce.number();", errors: [{ messageId: 'coerce' }] },
    { filename: SCHEMA, code: "import * as zz from 'zod';\nzz.discriminatedUnion('kind', []);", errors: [{ messageId: 'union' }] },
  ],
});

const VIEWMODEL = at('apps/mobile/src/features/home/useHome.ts');
const COMPONENT = at('apps/mobile/src/features/home/components/Banner.tsx');

ruleTester.run('arch/store-access', plugin.rules['store-access'], {
  valid: [
    // A ViewModel, or a private hook in components/, reads a store.
    { filename: VIEWMODEL, code: "import { useAuthStore } from '@skkuverse/shared';" },
    { filename: at('apps/mobile/src/features/home/components/useBannerState.ts'), code: "import { useSettingsStore } from '@skkuverse/shared';" },
    // A view imports other shared hooks, and store types.
    { filename: COMPONENT, code: "import { useT, useMiniAppIndex } from '@skkuverse/shared';" },
    { filename: COMPONENT, code: "import type { useAuthStore } from '@skkuverse/shared';" },
    { filename: COMPONENT, code: "import { type useAuthStore } from '@skkuverse/shared';" },
    // Outside the view layers, the rule does not apply.
    { filename: at('apps/mobile/src/bootstrap/useAppInit.ts'), code: "import { useAuthStore } from '@skkuverse/shared';" },
  ],
  invalid: [
    {
      filename: COMPONENT,
      code: "import { useSettingsStore } from '@skkuverse/shared';",
      errors: [{ messageId: 'store' }],
    },
    {
      filename: HOME,
      code: "import { useT, useAuthStore, useMapLayerStore } from '@skkuverse/shared';",
      errors: [{ messageId: 'store' }, { messageId: 'store' }],
    },
    {
      filename: ROUTE,
      code: "import { useNotificationStore } from '@skkuverse/shared/store/notifications';",
      errors: [{ messageId: 'store' }],
    },
  ],
});

const CLIENT = at('apps/mobile/src/features/home/home.client.ts');
const REPOSITORY = at('apps/mobile/src/features/home/home.repository.ts');
const STORE = at('apps/mobile/src/features/home/home.store.ts');
const SERVICE = at('apps/mobile/src/features/home/home.service.ts');

ruleTester.run('arch/data-direction', plugin.rules['data-direction'], {
  valid: [
    // Down the order: service > client, repository > store > pure.
    { filename: SERVICE, code: "import { fetchLayout } from './home.client';\nimport { readCache } from './home.repository';" },
    { filename: SERVICE, code: "import { useHomeStore } from './home.store';\nimport { buildSections } from './home.rules';" },
    { filename: CLIENT, code: "import { parseLayout } from './home.schema';" },
    { filename: REPOSITORY, code: "import { useHomeStore } from './home.store';" },
    { filename: STORE, code: "import { DEFAULT_TAB } from './home.constants';" },
    // The same role in another folder.
    { filename: CLIENT, code: "import { fetchConfig } from '@/features/bus/bus.client';" },
    // Types never cross a runtime boundary.
    { filename: CLIENT, code: "import type { HomeCache } from './home.repository';" },
    { filename: STORE, code: "import { type Layout } from './home.client';" },
    // A pure file reaching up is arch/pure-files' report, not a second one here.
    { filename: RULES, code: "import { fetchLayout } from './home.client';" },
    // Views and hooks are outside this rule.
    { filename: VIEWMODEL, code: "import { loadHome } from './home.service';" },
  ],
  invalid: [
    { filename: CLIENT, code: "import { readCache } from './home.repository';", errors: [{ messageId: 'sibling' }] },
    { filename: REPOSITORY, code: "import { fetchLayout } from './home.client';", errors: [{ messageId: 'sibling' }] },
    { filename: CLIENT, code: "import { loadHome } from './home.service';", errors: [{ messageId: 'service' }] },
    { filename: REPOSITORY, code: "export { loadHome } from '@/features/home/home.service';", errors: [{ messageId: 'service' }] },
    { filename: STORE, code: "import { fetchLayout } from './home.client';", errors: [{ messageId: 'store' }] },
    { filename: STORE, code: "import { readCache } from './home.repository';", errors: [{ messageId: 'store' }] },
    { filename: STORE, code: "import { loadHome } from '../home/home.service';", errors: [{ messageId: 'store' }] },
  ],
});

ruleTester.run('arch/shared-io', plugin.rules['shared-io'], {
  valid: [
    // The data roles and ViewModels do the I/O.
    { filename: CLIENT, code: "import { safeGet, getApiClient } from '@skkuverse/shared';" },
    { filename: REPOSITORY, code: "import { readCache, writeCache, clearCache } from '@skkuverse/shared';" },
    { filename: VIEWMODEL, code: "import { authStore, safePost } from '@skkuverse/shared';" },
    // A view or a pure file imports pure helpers, and types of anything.
    { filename: HOME, code: "import { t, ApiEndpoints, SdsSpacing } from '@skkuverse/shared';" },
    { filename: RULES, code: "import { tolerantArray, CAMPUSES } from '@skkuverse/shared';" },
    { filename: COMPONENT, code: "import type { AuthStore, safeGet } from '@skkuverse/shared';" },
    { filename: RULES, code: "import { type authStore } from '@skkuverse/shared';" },
    // A view's use*Store is arch/store-access' report, not a second one here.
    { filename: COMPONENT, code: "import { useAuthStore } from '@skkuverse/shared';" },
    // Another package's names.
    { filename: HOME, code: "import { readCache } from './cache-like';" },
  ],
  invalid: [
    {
      filename: HOME,
      code: "import { safeGet, safeGetRaw, safePost, firePost } from '@skkuverse/shared';",
      errors: [{ messageId: 'viewIo' }, { messageId: 'viewIo' }, { messageId: 'viewIo' }, { messageId: 'viewIo' }],
    },
    { filename: ROUTE, code: "import { getApiClient } from '@skkuverse/shared';", errors: [{ messageId: 'viewIo' }] },
    { filename: COMPONENT, code: "import { readCache } from '@skkuverse/shared/store/mmkv-cache';", errors: [{ messageId: 'viewIo' }] },
    { filename: COMPONENT, code: "import { authStore } from '@skkuverse/shared';", errors: [{ messageId: 'viewStore' }] },
    { filename: at('apps/mobile/src/components/Card.tsx'), code: "import { bookmarkStore } from '@skkuverse/shared';", errors: [{ messageId: 'viewStore' }] },
    { filename: RULES, code: "import { writeCache } from '@skkuverse/shared';", errors: [{ messageId: 'pureIo' }] },
    { filename: TOPIC_RULES, code: "import { safeGetConditional } from '@skkuverse/shared';", errors: [{ messageId: 'pureIo' }] },
    // A pure file reads no store at all, hook or object.
    { filename: RULES, code: "import { notificationStore } from '@skkuverse/shared';", errors: [{ messageId: 'pureStore' }] },
    { filename: SCHEMA, code: "import { useSettingsStore } from '@skkuverse/shared';", errors: [{ messageId: 'pureStore' }] },
  ],
});

ruleTester.run('arch/view-data', plugin.rules['view-data'], {
  valid: [
    // The ViewModel and the data roles own server state.
    { filename: VIEWMODEL, code: "import { useQuery, useQueryClient } from '@tanstack/react-query';" },
    { filename: SERVICE, code: "import { queryOptions } from '@tanstack/react-query';" },
    // Types only.
    { filename: HOME, code: "import type { UseQueryResult } from '@tanstack/react-query';" },
    { filename: COMPONENT, code: "import { type QueryKey } from '@tanstack/react-query';" },
    // Outside the view layers, the rule does not apply.
    { filename: at('apps/mobile/src/bootstrap/QueryProvider.tsx'), code: "import { QueryClientProvider } from '@tanstack/react-query';" },
  ],
  invalid: [
    { filename: HOME, code: "import { useQuery } from '@tanstack/react-query';", errors: [{ messageId: 'query' }] },
    {
      filename: ROUTE,
      code: "import { useQueryClient, type QueryKey, useMutation } from '@tanstack/react-query';",
      errors: [{ messageId: 'query' }, { messageId: 'query' }],
    },
    { filename: COMPONENT, code: "import * as rq from '@tanstack/react-query';", errors: [{ messageId: 'query' }] },
    { filename: at('apps/mobile/src/components/List.tsx'), code: "import { useInfiniteQuery } from '@tanstack/react-query';", errors: [{ messageId: 'query' }] },
  ],
});

const SHARED_SCHEMA = at('packages/shared/src/schema/banner-carousel.schema.ts');

ruleTester.run('arch/tolerant-schema', plugin.rules['tolerant-schema'], {
  valid: [
    {
      filename: SCHEMA,
      code: "import { z } from 'zod';\nimport { tolerantArray, openEnum } from '@skkuverse/shared';\nconst s = z.object({ items: tolerantArray(z.string(), 'items'), kind: openEnum(['a', 'b'], 'a') });",
    },
    // The helpers themselves are built on a bare array of unknowns.
    { filename: at('packages/shared/src/schema/tolerant.ts'), code: "import { z } from 'zod';\nz.array(z.unknown());\nz.enum(['a']);" },
    // Outside a .schema.ts file, the rule does not apply.
    { filename: at('apps/mobile/src/features/home/home.client.ts'), code: "import { z } from 'zod';\nz.array(z.string());" },
    // Not zod.
    { filename: SCHEMA, code: "const list = other.array(x);\nconst e = lib.enum(['a']);\nconst a = items.array();" },
  ],
  invalid: [
    { filename: SCHEMA, code: "import { z } from 'zod';\nz.array(z.string());", errors: [{ messageId: 'array' }] },
    { filename: SHARED_SCHEMA, code: "import * as zz from 'zod';\nzz.array(zz.number());", errors: [{ messageId: 'array' }] },
    { filename: SCHEMA, code: "import { z } from 'zod';\nz.string().nullable().array();", errors: [{ messageId: 'array' }] },
    { filename: SCHEMA, code: "import { z } from 'zod';\nz.enum(['a', 'b']);", errors: [{ messageId: 'enum' }] },
    { filename: SHARED_SCHEMA, code: "import { z } from 'zod';\nz.nativeEnum(Kind);", errors: [{ messageId: 'enum' }] },
  ],
});

const { SIZE_LIMITS, SIZE_STEP } = plugin._internal;
/** `n` lines of code, one statement each. */
const codeOf = (n) => Array.from({ length: n }, (_, i) => `export const v${i} = ${i};`).join('\n');
const HOOK_FILE_PATH = at('apps/mobile/src/features/home/useHome.ts');
// WHY line 1: a report on the Nth code line moved with every edit above it, so a disable there went stale.
const size = () => ({ messageId: 'size', line: 1, column: 1 });

ruleTester.run('arch/file-size', plugin.rules['file-size'], {
  valid: [
    // At the limit exactly.
    { filename: HOOK_FILE_PATH, code: codeOf(SIZE_LIMITS.hook) },
    { filename: HOME, code: codeOf(SIZE_LIMITS.file) },
    // Blank lines cost nothing.
    { filename: HOOK_FILE_PATH, code: `${codeOf(SIZE_LIMITS.hook)}\n\n\n` },
    // A view that also exports a hook stays a view.
    {
      filename: HOME,
      code: `export function HomeScreen() { return null; }\nexport const useHomeThing = () => 1;\n${codeOf(SIZE_LIMITS.hook)}`,
    },
    // A pure file is split by subject, not by size, and a generated one is not edited.
    { filename: at('apps/mobile/src/features/home/home.rules.ts'), code: codeOf(SIZE_LIMITS.file + 1) },
    { filename: at('apps/mobile/src/features/home/home.schema.ts'), code: codeOf(SIZE_LIMITS.file + 1) },
    { filename: at('apps/mobile/src/features/home/tabs.generated.ts'), code: codeOf(SIZE_LIMITS.file + 1) },
    // Outside the app, the rule does not apply.
    { filename: at('packages/shared/src/store/useThing.ts'), code: codeOf(SIZE_LIMITS.hook + 1) },
  ],
  invalid: [
    // One line past a hook's limit is one report, at that line.
    { filename: HOOK_FILE_PATH, code: codeOf(SIZE_LIMITS.hook + 1), errors: [size()] },
    // A use*.tsx hook is a hook too.
    { filename: at('apps/mobile/src/features/home/useHomeTabs.tsx'), code: codeOf(SIZE_LIMITS.hook + 1), errors: [size()] },
    // A step later, a second report: the record holds the count, so growing a step fails.
    {
      filename: HOOK_FILE_PATH,
      code: codeOf(SIZE_LIMITS.hook + SIZE_STEP + 1),
      errors: [size(), size()],
    },
    // A file whose exported functions are all hooks is a hook, whatever its name.
    {
      filename: at('apps/mobile/src/features/home/components/HomeTabs.tsx'),
      code: `export function useHomeTabs() { return 1; }\n${codeOf(SIZE_LIMITS.hook)}`,
      errors: [size()],
    },
    {
      filename: at('apps/mobile/src/features/home/components/Tabs.tsx'),
      code: `export default function useTabs() { return 1; }\n${codeOf(SIZE_LIMITS.hook)}`,
      errors: [size()],
    },
    // A view, a service, a route and a platform wrapper share the file limit.
    { filename: HOME, code: codeOf(SIZE_LIMITS.file + 1), errors: [size()] },
    { filename: at('apps/mobile/src/features/home/home.service.ts'), code: codeOf(SIZE_LIMITS.file + 1), errors: [size()] },
    { filename: at('apps/mobile/app/_layout.tsx'), code: codeOf(SIZE_LIMITS.file + 1), errors: [size()] },
    { filename: at('apps/mobile/src/platform/analytics.ts'), code: codeOf(SIZE_LIMITS.file + 1), errors: [size()] },
    // Comment lines count like code, a JSDoc block on every line it spans.
    {
      filename: HOOK_FILE_PATH,
      code: `${codeOf(SIZE_LIMITS.hook - 3)}\n\n// WHY: a comment\n/**\n * A JSDoc block.\n */\n`,
      errors: [size()],
    },
    {
      filename: HOOK_FILE_PATH,
      code: `// WHY: a header\n\n${codeOf(SIZE_LIMITS.hook)}`,
      errors: [size()],
    },
    // A multi-line template literal is code on every line it spans.
    {
      filename: HOOK_FILE_PATH,
      code: `${codeOf(SIZE_LIMITS.hook - 1)}\nexport const t = \`a\nb\`;`,
      errors: [size()],
    },
  ],
});

ruleTester.run('arch/schema-cast', plugin.rules['schema-cast'], {
  valid: [
    // Fields read through zod, and a literal frozen with `as const`.
    { filename: SCHEMA, code: "import { z } from 'zod';\nconst s = z.object({ label: text });\nconst KINDS = ['a', 'b'] as const;" },
    // `satisfies` checks against a type, it asserts nothing.
    { filename: SCHEMA, code: 'const s = z.object({ a: text }) satisfies z.ZodType<A>;' },
    // Outside a .schema.ts file, the rule does not apply.
    { filename: at('apps/mobile/src/features/home/home.rules.ts'), code: 'const a = raw.label as string;' },
  ],
  invalid: [
    { filename: SCHEMA, code: 'const a = raw.label as string;', errors: [{ messageId: 'cast' }] },
    { filename: SHARED_SCHEMA, code: 'const obj = (raw ?? {}) as Record<string, unknown>;', errors: [{ messageId: 'cast' }] },
    { filename: SCHEMA, code: 'const a = <string>raw.label;', errors: [{ messageId: 'cast' }] },
    // A double cast is one report, whichever syntax either half uses.
    { filename: SCHEMA, code: 'const a = raw as unknown as Thing;', errors: [{ messageId: 'cast' }] },
    { filename: SCHEMA, code: 'const a = <string>(raw as unknown);', errors: [{ messageId: 'cast' }] },
    { filename: SCHEMA, code: 'const a = (<unknown>raw) as string;', errors: [{ messageId: 'cast' }] },
    // A non-null assertion and `any` skip the check the same way a cast does.
    { filename: SCHEMA, code: 'const a = raw.label!;', errors: [{ messageId: 'nonNull' }] },
    { filename: SCHEMA, code: 'const parse = (raw: any) => raw.label;', errors: [{ messageId: 'any' }] },
    { filename: SHARED_SCHEMA, code: 'const list: Array<any> = [];', errors: [{ messageId: 'any' }] },
  ],
});

describe('arch/file-size: the one-line escape', () => {
  const { Linter } = require('eslint');
  const linter = new Linter({ configType: 'flat' });
  const config = [{ files: ['**/*.ts'], languageOptions: { parser: tsParser }, plugins: { arch: plugin }, rules: { 'arch/file-size': 'error' } }];
  const lint = (code) => linter.verify(code, config, { filename: HOOK_FILE_PATH }).map((m) => m.ruleId);

  it('a reasoned disable on line 1 holds every step, and still holds after a line is added above the code', () => {
    // Arrange
    const disable = '// eslint-disable-line arch/file-size -- a generated table of every station\n';
    const code = codeOf(SIZE_LIMITS.hook + SIZE_STEP + 1);

    // Act & Assert
    assert.deepEqual(lint(`${disable}${code}`), []);
    assert.deepEqual(lint(`${disable}export const added = 0;\n${code}`), []);
  });
});
