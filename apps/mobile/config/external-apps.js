/**
 * The other apps this app may look for and open — the one list both the native
 * declarations and the JS link policy read.
 *
 * `app.config.ts` writes it into iOS `LSApplicationQueriesSchemes` and the
 * Android manifest's `<queries>`: the platforms let `canOpenURL` see an app
 * only when it is declared there (an undeclared iOS scheme makes RN's
 * `canOpenURL` reject; on Android 11+ an undeclared package is invisible to
 * it). Opening is not gated — `Linking.openURL` reaches any installed handler —
 * so a declaration adds a question the app can ask, not a door it can open.
 *
 * The same list decides what a page in /webview or /mini-app may hand off to
 * another app (`src/features/web/navigation.rules.ts`). That is the other
 * half of declaring: react-native-webview's default whitelist hands a non-web
 * navigation to `canOpenURL` → `openURL` on its own, so once a scheme is
 * declared, any page could launch that app without a tap. The web views set
 * `originWhitelist={['*']}` and let the policy decide instead.
 *
 * CommonJS for the same reason as `constants.js`: `app.config.ts` requires it
 * through plain Node resolution.
 *
 * iOS caps the schemes an app built with a recent SDK may query (50 since
 * iOS 15, 25 when linked against iOS 27); a test keeps the list under 25.
 */

/**
 * Each app's iOS URL schemes and Android package. Apple Maps needs no entry:
 * it opens from an https address.
 *
 * @type {ReadonlyArray<{ ios: readonly string[]; android: string }>}
 */
exports.EXTERNAL_APPS = [
  { ios: ['instagram'], android: 'com.instagram.android' },
  { ios: ['kakaotalk', 'kakaolink', 'kakaoplus'], android: 'com.kakao.talk' },
  { ios: ['nmap'], android: 'com.nhn.android.nmap' },
  { ios: ['kakaomap'], android: 'net.daum.android.map' },
  { ios: ['naversearchapp'], android: 'com.nhn.android.search' },
  { ios: ['navercafe'], android: 'com.nhn.android.navercafe' },
  { ios: ['naverblog2'], android: 'com.nhn.android.blog' },
];

/** @type {readonly string[]} */
exports.DECLARED_APP_SCHEMES = exports.EXTERNAL_APPS.flatMap((app) => app.ios);

/** @type {readonly string[]} */
exports.DECLARED_APP_PACKAGES = exports.EXTERNAL_APPS.map((app) => app.android);

/**
 * The schemes an `appUrl` may open (`web:open-url`, a mini app's `link.open`,
 * the Kakao channel row): the declared ones plus the apps the playlist mini app
 * links to. Those last three are opened, never asked about, so they need no
 * declaration — but leaving them off would send their buttons to the web.
 *
 * @type {readonly string[]}
 */
exports.OPENABLE_APP_SCHEMES = [
  ...exports.DECLARED_APP_SCHEMES,
  'youtube',
  'vnd.youtube',
  'spotify',
];
