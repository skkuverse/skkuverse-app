/**
 * Expo config plugin: fix Firebase modular header issues on iOS.
 *
 * Fixes:
 * 1. "include of non-modular header inside framework module 'RNFBApp'"
 * 2. "declaration of 'RCTBridgeModule' must be imported from module
 *    'RNFBApp.RNFBAppModule'" (Crashlytics + New Arch + static frameworks)
 *
 * Applied in the Podfile post_install hook because errors originate in
 * CocoaPods targets which have their own build configurations.
 *
 * Also pins the Firebase iOS SDK ($FirebaseSDKVersion, read by every RNFB
 * podspec) above the 12.18.0 that RNFB 26.4.0 ships with: 12.18.0 no longer
 * calls the FCM token delegate at launch (firebase-ios-sdk#16581), fixed in
 * 12.19.0. Delete the pin once the installed RNFB ships 12.19.0 or later
 * (`sdkVersions.ios.firebase` in @react-native-firebase/app's package.json).
 */
const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = function withFirebaseModularHeaders(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile",
      );
      let podfile = fs.readFileSync(podfilePath, "utf8");

      // 1. Set $RNFirebaseAsStaticFramework before targets
      const staticFrameworkSnippet = `$RNFirebaseAsStaticFramework = true\n`;
      if (!podfile.includes("$RNFirebaseAsStaticFramework")) {
        podfile = podfile.replace(
          /platform :ios/,
          `${staticFrameworkSnippet}platform :ios`,
        );
      }

      // 2. Pin the Firebase iOS SDK (see the header)
      const sdkVersionSnippet = `$FirebaseSDKVersion = '12.19.0'\n`;
      if (!podfile.includes("$FirebaseSDKVersion")) {
        podfile = podfile.replace(
          /platform :ios/,
          `${sdkVersionSnippet}platform :ios`,
        );
      }

      // 3. Inject into post_install hook
      const snippet = `
    # [withFirebaseModularHeaders] Fix Firebase + New Architecture modular header issues
    installer.pods_project.build_configurations.each do |config|
      config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
    end
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
      # Disable Clang modules for RNFB targets to fix
      # "declaration of 'RCTBridgeModule' must be imported from module" error
      if target.name.start_with?('RNFB')
        target.build_configurations.each do |config|
          config.build_settings['CLANG_ENABLE_MODULES'] = 'NO'
        end
      end
    end`;

      // Insert after post_install opening
      if (podfile.includes("post_install do |installer|")) {
        podfile = podfile.replace(
          /post_install do \|installer\|/,
          `post_install do |installer|${snippet}`,
        );
      }

      fs.writeFileSync(podfilePath, podfile, "utf8");
      return config;
    },
  ]);
};
