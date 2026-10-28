/**
 * Expo config plugin: upload Android native (NDK) symbols to Crashlytics.
 *
 * @react-native-firebase/crashlytics links firebase-crashlytics-ndk, so a C++
 * crash is captured, but its config plugin takes no options and never sets
 * `nativeSymbolUploadEnabled`. Without it the Crashlytics Gradle plugin does
 * not register `uploadCrashlyticsSymbolFileRelease` at all, and every native
 * frame in the console is `lib*.so + 0x...`. Play Console gets symbol tables
 * from the AAB on its own (AGP's release default), so this is for Crashlytics.
 *
 * The block is deferred with `pluginManager.withPlugin` because the
 * `firebaseCrashlytics` build-type extension exists only once
 * `apply plugin: 'com.google.firebase.crashlytics'` has run, and RNFB appends
 * that line after this plugin's block. Plugin order in app.config.ts then
 * does not matter.
 *
 * This only registers the tasks. The upload runs because the beta and
 * production profiles in eas.json name it in `gradleCommand`.
 * docs/how-to/android-build-deploy.md
 */
const { withAppBuildGradle } = require("expo/config-plugins");

const MARKER = "// @generated withCrashlyticsNativeSymbols";

const BLOCK = `
${MARKER}
pluginManager.withPlugin("com.google.firebase.crashlytics") {
    android.buildTypes.release.firebaseCrashlytics {
        nativeSymbolUploadEnabled true
    }
}
`;

module.exports = function withCrashlyticsNativeSymbols(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      throw new Error(
        "withCrashlyticsNativeSymbols: app/build.gradle is not Groovy; update the block for Kotlin DSL.",
      );
    }
    if (!config.modResults.contents.includes(MARKER)) {
      config.modResults.contents += BLOCK;
    }
    return config;
  });
};
