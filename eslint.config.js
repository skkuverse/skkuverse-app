// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");
const sds = require("./scripts/eslint/plugin-sds.cjs");
const sdsExceptions = require("./scripts/eslint/sds-exceptions.cjs");
const arch = require("./scripts/eslint/plugin-arch.cjs");

// The React Native UI code the sds/* design rules govern: the app's screens
// and SDS itself. Token files, bridge, native config and build scripts fall
// outside these globs.
const APP_UI = ["apps/mobile/app/**/*.{ts,tsx}", "apps/mobile/src/**/*.{ts,tsx}"];
const SDS_UI = [...APP_UI, "packages/sds/src/**/*.{ts,tsx}"];
// Tests spell the values they assert.
const NOT_UI_CODE = ["**/__tests__/**", "**/*.test.*", "**/*.typetest.*"];
// The app and the shared package, where zod parses server responses.
const APP_AND_SHARED = [...APP_UI, "packages/shared/src/**/*.{ts,tsx}"];

// The OS's scheme. A block that sets no-restricted-imports for its own files
// must list this too, or the ban drops there.
const USE_COLOR_SCHEME = {
  name: "react-native",
  importNames: ["useColorScheme"],
  message:
    "Read the scheme from SDS: useResolvedScheme(), useSemanticColors() or createThemedStyles() from @skkuverse/sds. The OS's answer ignores the app's colorMode policy.",
};

module.exports = defineConfig([
  expoConfig,
  {
    // `.claude/**` holds agent worktrees (whole checkouts), which the root
    // glob would otherwise lint twice; markdownlint skips them through
    // `gitignore: true`, since `.claude/*` is gitignored.
    ignores: ["**/dist/**", "**/.expo/**", "**/*.generated.ts", ".claude/**"],
  },
  {
    rules: {
      "import/no-unresolved": "off",
    },
  },
  {
    // Every way the app hands the screen to something else goes through
    // apps/mobile/src/platform/handoff.ts, which marks it first. On Android
    // each one backgrounds the app, and an unmarked one makes the
    // app_foreground that follows look like the user left
    // (src/platform/handoff.rules.ts).
    ignores: ["apps/mobile/src/platform/handoff.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        ...[
          ["Linking", "openURL", "openExternalUrl"],
          ["Linking", "openSettings", "openAppSettings"],
          ["Linking", "sendIntent", "sendSettingsIntent"],
          ["WebBrowser", "openBrowserAsync", "openInAppBrowser"],
          ["Share", "share", "shareContent"],
        ].map(([object, property, wrapper]) => ({
          object,
          property,
          message: `Use ${wrapper}() from @/platform/handoff, which marks the hand-off for app_foreground.`,
        })),
      ],
    },
  },
  {
    // One source for light or dark: SDSProvider resolves the app's policy
    // against the OS once (packages/sds/src/core/ColorSchemeProvider.tsx, the
    // one file allowed to ask), and everything reads that answer. SDS and
    // shared internals are not API, and the deprecated SDS parts stay out.
    //
    // Every restricted import lives in this one array. A second
    // no-restricted-imports block would replace these options for the files
    // it matches, so it would have to repeat USE_COLOR_SCHEME.
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            USE_COLOR_SCHEME,
            {
              name: "@skkuverse/sds",
              importNames: ["Result", "ErrorPage"],
              message:
                'Deprecated. Use ResultSection from @skkuverse/sds (ADR 0015). See RESULT-01 in packages/sds/SDS.md "Lint rules".',
            },
            {
              name: "@skkuverse/sds",
              importNames: ["useAdaptive", "AdaptiveColorProvider", "colorSeeds", "getAdaptiveColors"],
              message:
                'The TDS theme layer. Read a role through useSemanticColors() or createThemedStyles(), and pin a subtree\'s scheme with ColorSchemeProvider. See COLOR-01 in packages/sds/SDS.md "Lint rules".',
            },
          ],
          patterns: [
            {
              group: ["@skkuverse/sds/*", "@skkuverse/shared/*"],
              message:
                "Import from the package index: SDS and shared internals are not API, and a recipe table a screen needs belongs in the index.",
            },
          ],
        },
      ],
    },
  },
  {
    // Style code only: a test asserting what the resolver returns has to
    // spell the face names it expects.
    ignores: ["**/__tests__/**", "**/*.test.*"],
    rules: {
      // A WantedSans weight is a font *file* on Android, so the family and
      // the weight have to move together (packages/shared/src/tokens/fontFace.ts).
      // Either pattern below renders in the system font on Android only,
      // with nothing on iOS to notice it by.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "SpreadElement[argument.object.name='SdsTypo'] ~ Property[key.name='fontWeight']",
          message:
            "Overriding fontWeight on an SdsTypo token loses the font on Android. Spread `...wantedSans('<weight>')` instead.",
        },
        {
          selector: "Property[key.name='fontFamily'] > Literal[value=/^WantedSans/]",
          message:
            "Spell WantedSans through `...wantedSans('<weight>')` (or an SdsTypo token), which picks the Android font file.",
        },
        // The TDS names survive in spacing.ts and radius.ts only for the
        // copies the umbrella vendors into the web repos (docs/decisions/0013).
        {
          selector:
            "MemberExpression[object.name='SdsSpacing'][property.name=/^(xxs|xs|sm|md|base|lg|xl|xxl)$/]",
          message: "A TDS spacing name. Use the SEED step: xxs→x0_5, xs→x1, sm→x2, md→x3, base→x4, lg→x5, xl→x6, xxl→x8.",
        },
        {
          selector: "MemberExpression[object.name='SdsRadius'][property.name=/^(xs|sm|md|lg|xl)$/]",
          message: "A TDS radius name. Use the SEED step: xs→r1, sm→r2, md→r3, lg→r3_5, xl→r4.",
        },
      ],
    },
  },
  {
    // The local sds plugin (scripts/eslint/plugin-sds.cjs). Its rules run at
    // error over a recorded backlog: eslint-suppressions.json holds today's
    // violations per file and rule, and scripts/check-suppressions-ratchet.mjs
    // keeps that record from growing (docs/decisions/0016). An sds/* rule is
    // switched off only by its `files` scope here, an entry in
    // scripts/eslint/sds-exceptions.cjs, or a line-level disable with a reason,
    // which sds/require-disable-reason enforces. A stale disable is an error
    // rather than the default warning, so it fails whatever --max-warnings is.
    linterOptions: { reportUnusedDisableDirectives: "error" },
    plugins: { sds },
    rules: {
      "sds/require-disable-reason": "error",
    },
  },
  {
    // The SDS design rules on the React Native UI code. Each message names
    // the replacement and the usage rule (packages/sds/SDS.md "Lint rules").
    files: SDS_UI,
    ignores: NOT_UI_CODE,
    rules: {
      "sds/no-color-in-string": "error",
      "sds/no-static-theme": "error",
      "sds/no-font-family-literal": "error",
      "sds/no-vector-icons": "error",
      "sds/no-sds-colors": "error",
      "sds/no-color-literal": "error",
      "sds/no-raw-shadow": "error",
      "sds/no-fixed-scheme": "error",
      "sds/no-entering-over-glass": "error",
      "sds/role-placement": "error",
      "sds/no-rn-text": "error",
      "sds/no-type-size-literal": "error",
      "sds/no-font-weight-literal": "error",
      "sds/no-spacing-literal": "error",
      "sds/no-radius-literal": "error",
      "sds/no-rn-pressable": "error",
      "sds/no-press-opacity": "error",
      "sds/no-rn-primitive": "error",
      "sds/android-accessibility-role": "error",
    },
  },
  {
    // App code only: SDS defines the roles, and its internals may name them;
    // SDS's own components are the parts a hand-built one should have used.
    files: APP_UI,
    ignores: NOT_UI_CODE,
    rules: {
      "sds/no-role-cast": "error",
      "sds/no-handbuilt-part": "error",
    },
  },
  {
    // SDS's own components: the TDS adaptive hook is gone, and stays gone.
    // A color prop takes a role by its type (ADR 0015), not by a rule.
    files: ["packages/sds/src/components/**/*.{ts,tsx}"],
    ignores: NOT_UI_CODE,
    rules: {
      "sds/no-use-adaptive": "error",
    },
  },
  {
    // A recipe's node --test loads it with the types stripped.
    files: ["packages/sds/src/components/**/*Recipe.ts"],
    rules: {
      "sds/recipe-type-imports": "error",
    },
  },
  {
    // The app architecture's import rules (scripts/eslint/plugin-arch.cjs,
    // docs/decisions/0020-app-architecture.md). Like the sds/* rules they run
    // at error over a backlog recorded in eslint-suppressions.json
    // (docs/decisions/0016), one rule ID per concern.
    files: APP_UI,
    ignores: NOT_UI_CODE,
    plugins: { arch },
    rules: {
      "arch/banned-folder-door": "error",
      "arch/data-direction": "error",
      "arch/feature-door": "error",
      "arch/file-size": "error",
      "arch/layer-imports": "error",
      "arch/pure-files": "error",
      "arch/shared-io": "error",
      "arch/sibling-import": "error",
      "arch/store-access": "error",
      "arch/view-data": "error",
      // WHY: arch/file-size counts lines of code, so joining statements on one
      // line would dodge it (docs/decisions/0025-ratchet-file-size.md).
      "max-statements-per-line": ["error", { max: 1 }],
    },
  },
  {
    // Analytics, Crashlytics, App Check and hot-updater are reached only
    // through their platform wrappers (ADR 0020 D2); index.ts loads crashlytics
    // before any route, so it is in scope too. Its record is empty.
    files: [...APP_UI, "apps/mobile/index.ts"],
    ignores: NOT_UI_CODE,
    plugins: { arch },
    rules: {
      "arch/platform-sdk": "error",
    },
  },
  {
    // Server responses parse tolerantly wherever zod is used, and are checked
    // rather than cast (ADR 0020 D6).
    files: APP_AND_SHARED,
    ignores: NOT_UI_CODE,
    plugins: { arch },
    rules: {
      "arch/schema-cast": "error",
      "arch/tolerant-schema": "error",
      "arch/zod-usage": "error",
    },
  },
  // Last, so an exception overrides the rule block it switches off.
  ...sdsExceptions.map(({ files, rules }) => ({
    files,
    rules: Object.fromEntries(rules.map((rule) => [rule, "off"])),
  })),
]);
