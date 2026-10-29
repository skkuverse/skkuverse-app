import { ExpoConfig, ConfigContext } from "expo/config";
import { NAVER_MAP_CLIENT_ID, PROD_API_URL } from "./config/constants";
import { DECLARED_APP_PACKAGES, DECLARED_APP_SCHEMES } from "./config/external-apps";

// Substrings that only ever appear in a host living on a developer's machine.
// `localhost` and `127.0.0.1` resolve to the phone itself once the bundle is on
// a device, and `10.0.2.2` is the Android emulator's alias for the host
// loopback, so all three are unreachable from a real install. `http://` is here
// too: every deployed API host is https, so a plaintext scheme is a dev-server
// tell no matter what follows it.
const LOCAL_HOST_MARKERS = ["localhost", "127.0.0.1", "10.0.2.2", "http://"];

// The EAS profiles whose artifacts leave this machine — `beta` to TestFlight
// and Play internal testing, `production` to the App Store and Play production.
// `development`, and the unset value a plain `expo start` / `expo run:ios`
// carries, both stay on the developer's own device and are exempt below.
const SHIPPING_PROFILES = ["beta", "production"];

// WHY: only expo-constants' build script writes `extra` into the binary, from Xcode's script phase
// or Gradle's createExpoConfig on every native build. Metro evaluates this file in its own process
// and serves `extra` to whoever reaches it, so the caller decides, not an env var Metro could inherit.
const EVALUATED_FOR_BINARY = /[\\/]expo-constants[\\/]scripts[\\/]getAppConfig\.js$/.test(
  process.argv[1] ?? "",
);

// WHY: a shipping profile ignores EXPO_PUBLIC_BASE_URL rather than defaulting it, since a shell
// `export` outranks `.env`. Elsewhere it stays optional: eas-cli evaluates this file with
// EXPO_NO_DOTENV=1, so a throw on a missing value would break every eas-cli command.
function resolveBaseUrl(): string {
  // WHY: a native build sets EAS_BUILD_PROFILE and an OTA publish sets only RELEASE_CHANNEL, so both
  // are read. The App Check strip below keys on the same pair; a new way to ship must teach both.
  const profile = process.env.EAS_BUILD_PROFILE ?? process.env.RELEASE_CHANNEL;
  const isShipping = profile !== undefined && SHIPPING_PROFILES.includes(profile);

  if (isShipping) {
    // Redundant assertion, kept deliberately. PROD_API_URL is a committed
    // constant a few lines away in `config/constants.js`, so this branch cannot
    // fire as long as that constant is a real https host — it is unreachable by
    // construction, not by luck. It stays because it costs nothing and because
    // its unreachability is exactly what makes it worth having: if it ever does
    // fire, the constant itself has been edited into something that must not
    // ship, and the build must still die here rather than reach a user's phone.
    // A tripwire behind the structure, not the structure.
    const localMarker = LOCAL_HOST_MARKERS.find((marker) =>
      PROD_API_URL.toLowerCase().includes(marker),
    );
    if (localMarker !== undefined) {
      const source =
        process.env.EAS_BUILD_PROFILE !== undefined
          ? "EAS_BUILD_PROFILE"
          : "RELEASE_CHANNEL";
      throw new Error(
        `PROD_API_URL is "${PROD_API_URL}", which points at a local ` +
          `development host (matched on "${localMarker}"), but ` +
          `${source} is "${profile}" — an artifact from that profile goes to ` +
          "real users, whose phones cannot reach it. This should be " +
          "impossible: PROD_API_URL is a committed constant in " +
          "apps/mobile/config/constants.js and EXPO_PUBLIC_BASE_URL is not " +
          "read on a shipping profile at all. Something upstream edited that " +
          "constant — fix it there, not here.",
      );
    }
    return PROD_API_URL;
  }

  // Not shipping: local development, where the override is the whole point.
  // Trimmed, because `''` and `'  '` both mean the substitution never happened
  // — the same reasoning `packages/shared/src/api/config.ts` trims on.
  //
  // QUIRK(expo-constants): with no expo-dev-client, a debug build reads `extra`
  // from the app config compiled into the binary, so a changed override needs a
  // native rebuild (`expo run:ios`); restarting Metro changes nothing.
  return process.env.EXPO_PUBLIC_BASE_URL?.trim() || PROD_API_URL;
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "스꾸버스",
  slug: "skkubus",
  owner: "seungyongcho",
  version: "3.6.3",
  orientation: "default",
  icon: "./assets/images/icon.png",
  scheme: "skkuverse",
  userInterfaceStyle: "light",
  extra: {
    // Always present, and on a shipping profile always PROD_API_URL — see
    // resolveBaseUrl above for why the environment variable is ignored rather
    // than merely defaulted there. `packages/shared/src/api/config.ts` still
    // throws on a missing value at module init, covering the runtime path this
    // file never sees; it is now a genuinely unreachable assertion rather than
    // the thing standing between a release and a wrong host.
    baseUrl: resolveBaseUrl(),
    // Debug-only. Surfaced so app-check.ts can pass it into
    // provider.configure({ debugToken }) — RN Firebase then setenv()'s
    // FIRAAppCheckDebugToken, which is the only App Check debug-token
    // injection path that reliably works on iOS Simulator (UserDefaults
    // fallback is silently ignored for unclear reasons — likely GULUserDefaults
    // caching interaction).
    //
    // Guard: these must never reach an artifact that leaves this machine. A
    // registered debug token mints valid App Check tokens, so it bypasses App
    // Attest / Play Integrity outright, and this repository is public.
    //
    // BINARY ONLY: a dev server hands `extra` to anyone who reaches it, so the
    // tokens enter it only when the build script evaluates this file
    // (EVALUATED_FOR_BINARY). A build without a dev client reads the extras
    // compiled into it, never Metro's.
    //
    // DEFAULT-DENY, and read why before loosening it. Keying on
    // EAS_BUILD_PROFILE alone failed open on the OTA path, which sets
    // RELEASE_CHANNEL instead. So include the tokens only when NEITHER
    // shipping signal is present, and an unrecognised future release path
    // omits the secret rather than leaking it. Same two-variable signal as resolveBaseUrl above — when a new way to
    // ship appears, both need teaching about it, and both fail safe until then.
    ...(EVALUATED_FOR_BINARY &&
    process.env.EAS_BUILD_PROFILE === undefined &&
    process.env.RELEASE_CHANNEL === undefined
      ? {
          firebaseAppCheckDebugTokenIos:
            process.env.FIREBASE_APP_CHECK_DEBUG_TOKEN_IOS,
          firebaseAppCheckDebugTokenAndroid:
            process.env.FIREBASE_APP_CHECK_DEBUG_TOKEN_ANDROID,
        }
      : {}),
    eas: {
      projectId: "43e326a2-2f25-4317-a341-a107a52c5405",
    },
  },
  ios: {
    bundleIdentifier: "com.example.skkumap",
    // Read by @bacons/apple-targets for the extension targets' DEVELOPMENT_TEAM.
    appleTeamId: "95HGXTX76L",
    supportsTablet: true,
    buildNumber: "69",
    icon: "./assets/skkuverse-logo.icon",
    googleServicesFile: "./GoogleService-Info.plist",
    associatedDomains: ["applinks:skkuverse.com"],
    entitlements: {
      "aps-environment":
        process.env.APP_ENV === "development" ? "development" : "production",
    },
    requireFullScreen: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      UIBackgroundModes: ["remote-notification"],
      // Apps `canOpenURL` may ask about. Declaring is safe only because the
      // web views route every non-web navigation through the link policy.
      // config/external-apps.js
      LSApplicationQueriesSchemes: [...DECLARED_APP_SCHEMES],
    },
  },
  android: {
    package: "com.zoyoong.skkubus",
    googleServicesFile: "./google-services.json",
    adaptiveIcon: {
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundColor: "#1f3d2e",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        // `pathPrefix` scopes this to the universal-link namespace. Without it the
        // app claimed EVERY https://skkuverse.com URL — so tapping a link to the
        // privacy policy opened the app, which then whitelist-rejected the path
        // and dropped the user on the home tab. The policy and terms pages were
        // unreachable from a link tap on Android, while iOS excluded them all
        // along via the AASA's `NOT /privacy` / `NOT /terms` rules. This restores
        // the symmetry.
        //
        // The trailing slash is load-bearing: `pathPrefix` is a plain string
        // prefix, so "/p" would still match "/privacy" and change nothing.
        data: [{ scheme: "https", host: "skkuverse.com", pathPrefix: "/p/" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  plugins: [
    ["expo-screen-orientation", { initialOrientation: "DEFAULT" }],
    // RNFB 26 links Firebase through SPM by default, which refuses the static
    // frameworks below; CocoaPods also lets the Podfile pin the SDK version
    // (plugins/withFirebaseModularHeaders).
    ["@react-native-firebase/app", { ios: { disableSPM: true } }],
    "@react-native-firebase/auth",
    "@react-native-firebase/crashlytics",
    "@react-native-firebase/app-check",
    "@react-native-firebase/messaging",
    // No props on purpose. `color` and `defaultChannel` become
    // default_notification_* meta-data that RNFB's library manifest already
    // declares, and the expo plugin writes them without tools:replace.
    "expo-notifications",
    // OTA from runtime 3.6.2: hot-updater replaces expo-updates. `version`
    // above is the app version deploys target (`-t 3.6.2`, updateStrategy
    // appVersion in hot-updater.config.ts), so bump it with every native
    // release. The public key's private half exists only in Cloud KMS; CI
    // signs every bundle with it and the binary rejects anything else.
    // Binaries up to 3.6.0 still run expo-updates against ota.skkuverse.com.
    [
      "@hot-updater/expo",
      {
        channel:
          process.env.EAS_BUILD_PROFILE === "beta" ? "beta" : "production",
        publicKeyPath: "./keys/hot-updater-public.pem",
      },
    ],
    "@react-native-google-signin/google-signin",
    "expo-router",
    "expo-secure-store",
    [
      "expo-build-properties",
      {
        ios: {
          useFrameworks: "static",
          // Expo SDK 56+ floor (React Native 0.85+). Below it expo-build-properties
          // refuses to evaluate the config at all.
          deploymentTarget: "16.4",
          extraPods: [
            { name: "GoogleMobileAdsMediationFacebook" },
          ],
        },
        android: {
          extraMavenRepos: ["https://repository.map.naver.com/archive/maven"],
          dependencies: [
            "com.google.ads.mediation:facebook:6.21.0.1",
          ],
          // Android 11+ package visibility: the iOS schemes' counterpart, from
          // the same list (config/external-apps.js). Appended to the template's
          // https VIEW query, which stays.
          manifestQueries: { package: [...DECLARED_APP_PACKAGES] },
          // QUIRK(android): left in the APK, SoLoader looks only under Build.SUPPORTED_ABIS[0], not the ABI the
          // package manager installed, so an x86_64 emulator with ARM translation dies in MainApplication.onCreate
          // (facebook/react-native#55562). Dropping the x86 ABIs misses the reverse case. Costs on-device size.
          useLegacyPackaging: true,
        },
      },
    ],
    "./plugins/withFirebaseModularHeaders",
    "./plugins/withCrashlyticsNativeSymbols",
    "./plugins/withPushNotificationsCapability",
    // Builds every folder under targets/ into an Xcode target. The one there
    // is the Notification Service Extension that reports iOS push delivery to
    // BigQuery (targets/NotificationService).
    "@bacons/apple-targets",
    "./plugins/withLocalizedAppName",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#ffffff",
        image: "./assets/images/transparent_1x1.png",
      },
    ],
    [
      "expo-font",
      {
        fonts: [
          "./assets/fonts/WantedSans-Regular.otf",
          "./assets/fonts/WantedSans-Medium.otf",
          "./assets/fonts/WantedSans-Bold.otf",
          "./assets/fonts/TossFaceFontMac.ttf",
          "./assets/fonts/IBMPlexSansKR-Bold.ttf",
          "./assets/fonts/IBMPlexSansKR-SemiBold.ttf",
        ],
      },
    ],
    [
      "expo-localization",
      {
        supportedLocales: ["en", "ko", "zh"],
      },
    ],
    [
      // Location permission is declared HERE, not through the Naver Map plugin
      // below. That plugin accepts an `ios.NSLocationWhenInUseUsageDescription`
      // option and then writes the value to `NSLocationAlwaysUsageDescription`
      // instead (expo-config-plugin/build/index.js:15-17) — a different key,
      // deprecated since iOS 10. On iOS 11+ that leaves
      // `requestWhenInUseAuthorization` with no usage string, so the permission
      // prompt never appears and nothing errors. This plugin writes the correct
      // key and adds ACCESS_FINE_LOCATION / ACCESS_COARSE_LOCATION on Android.
      "expo-location",
      {
        // Product copy, Korean: shown verbatim in the iOS permission dialog.
        // Single-language for now — this repo has no InfoPlist.strings
        // localisation (`withLocalizedAppName` covers the app name alone).
        // conventions:allow-korean
        locationWhenInUsePermission:
          "현위치를 지도에 표시하고 캠퍼스 내 위치를 안내하는 데 사용합니다.",
      },
    ],
    [
      "@mj-studio/react-native-naver-map",
      {
        // Committed constant, not an env var. It never varied between dev and
        // release, and reading it from `.env` meant an empty string whenever
        // the file was not present — which on the release paths is *always*,
        // since eas-cli and eoas both evaluate this config with
        // EXPO_NO_DOTENV=1. See `config/constants.js` for why the value is
        // safe in a public repo (Naver binds it to the bundle ID / package).
        client_id: NAVER_MAP_CLIENT_ID,
      },
    ],
    [
      "react-native-google-mobile-ads",
      {
        androidAppId: "ca-app-pub-5619947536545679~7806829793",
        iosAppId: "ca-app-pub-5619947536545679~7068085893",
        // Apple SKAdNetwork attribution IDs, written into ios/Info.plist by this
        // plugin. The plugin ships NO default list — it writes exactly what is
        // here — so this array is the whole configuration.
        //
        // **It must live here, not in ios/Info.plist.** `apps/mobile/ios` is
        // gitignored under CNG, so a hand-edit there is erased by the next
        // `expo prebuild --clean` with nothing tracking that it ever existed.
        //
        // Verified 2026-08-30 against
        // https://developers.google.com/ad-manager/mobile-ads-sdk/ios/3p-skadnetworks
        // (list last updated 2026-01-30): an exact 50/50 match, no additions and
        // no strays. Google adds buyers over time, so re-diff it against that
        // page whenever a store build goes out.
        //
        // AdMob's home page keeps recommending "configure Apple SKAdNetwork"
        // anyway. That card is a generic checklist item rather than a check on this
        // app: it offers only "view docs" and "hide", AdMob cannot read the
        // binary's Info.plist, and publishers who ship the full list report the
        // same card persisting (support.google.com/admob/thread/252552941).
        // Dismiss it; do not "fix" this list in response to it.
        skAdNetworkItems: [
          "cstr6suwn9.skadnetwork",
          "22mmun2rn5.skadnetwork",
          "2fnua5tdw4.skadnetwork",
          "2u9pt9hc89.skadnetwork",
          "3qcr597p9d.skadnetwork",
          "3qy4746246.skadnetwork",
          "3rd42ekr43.skadnetwork",
          "3sh42y64q3.skadnetwork",
          "4468km3ulz.skadnetwork",
          "44jx6755aq.skadnetwork",
          "47vhws6wlr.skadnetwork",
          "4dzt52r2t5.skadnetwork",
          "4fzdc2evr5.skadnetwork",
          "578prtvx9j.skadnetwork",
          "7ug5zh24hu.skadnetwork",
          "8c4e2ghe7u.skadnetwork",
          "8s468mfl3y.skadnetwork",
          "97r2b46745.skadnetwork",
          "9t245vhmpl.skadnetwork",
          "a2p9lx4jpn.skadnetwork",
          "c3frkrj4fj.skadnetwork",
          "c6k4g5qg8m.skadnetwork",
          "cp8zw746q7.skadnetwork",
          "e5fvkxwrpn.skadnetwork",
          "f38h382jlk.skadnetwork",
          "gta9lk7p23.skadnetwork",
          "hs6bdukanm.skadnetwork",
          "k674qkevps.skadnetwork",
          "kbd757ywx3.skadnetwork",
          "kbmxgpxpgc.skadnetwork",
          "klf5c3l5u5.skadnetwork",
          "ludvb6z3bs.skadnetwork",
          "mlmmfzh3r3.skadnetwork",
          "n38lu8286q.skadnetwork",
          "p78axxw29g.skadnetwork",
          "ppxm28t8ap.skadnetwork",
          "s39g8k73mm.skadnetwork",
          "su67r6k2v3.skadnetwork",
          "t38b2kh725.skadnetwork",
          "tl55sbb4fm.skadnetwork",
          "uw77j35x4d.skadnetwork",
          "v4nxqhlyqp.skadnetwork",
          "v72qych5uu.skadnetwork",
          "v9wttpbfk9.skadnetwork",
          "vutu7akeur.skadnetwork",
          "wg4vff78zm.skadnetwork",
          "wzmmz9fp6w.skadnetwork",
          "y5ghdn5j9k.skadnetwork",
          "yclnxrl5pm.skadnetwork",
          "ydx93a7ass.skadnetwork",
        ],
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
    // Bundle every autolinked native module's JS from the copy that was
    // compiled natively. @expo/cli turns this on only for a workspace, and
    // EXPO_NO_METRO_WORKSPACE_ROOT=1 in eas.json's beta and production env
    // stops it counting as one, so without this line a nested duplicate
    // (expo-router's own react-native-screens 4.28.0 against native 4.26.2,
    // 8dc51bd..637cf78) was bundled into release binaries alone while dev and
    // OTA used the root copy. docs/how-to/ios-build-deploy.md
    autolinkingModuleResolution: true,
  },
});
