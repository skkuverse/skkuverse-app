/**
 * Expo config plugin: add Push Notifications system capability to Xcode project.
 *
 * Without SystemCapabilities, Xcode may not include push entitlements in the
 * provisioning profile, causing `aps-environment` to be stripped from the build.
 *
 * Neither installed plugin sets it: @react-native-firebase/messaging does
 * nothing for iOS, and expo-notifications only adds the `aps-environment`
 * entitlement (when missing), never SystemCapabilities.
 *
 * Applied to the application target only. The project also has a Notification
 * Service Extension (targets/NotificationService), which needs no push
 * capability, and `getFirstTarget()` is whichever target the project lists
 * first, so it is not a safe way to find the app.
 *
 * NOTE: DevelopmentTeam is NOT set here — EAS build manages signing separately
 * via credentials.json. Setting it here would conflict with EAS code signing.
 */
const { withXcodeProject } = require("expo/config-plugins");

const APPLICATION = '"com.apple.product-type.application"';

/** The uuid of the app target, or undefined when there is not exactly one. */
function findApplicationTarget(xcodeProject) {
  const targets = xcodeProject.pbxNativeTargetSection();
  const apps = Object.keys(targets).filter(
    (uuid) =>
      !uuid.endsWith("_comment") &&
      [APPLICATION, APPLICATION.slice(1, -1)].includes(targets[uuid].productType),
  );
  return apps.length === 1 ? apps[0] : undefined;
}

module.exports = function withPushNotificationsCapability(config) {
  return withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const projectSection = xcodeProject.pbxProjectSection();
    const projectUuid = xcodeProject.getFirstProject().uuid;
    const targetUuid = findApplicationTarget(xcodeProject);

    if (!targetUuid || !projectSection[projectUuid]) {
      throw new Error(
        "[withPushNotificationsCapability] expected exactly one application target in the Xcode project",
      );
    }

    const attributes = projectSection[projectUuid].attributes;
    if (!attributes.TargetAttributes) {
      attributes.TargetAttributes = {};
    }
    if (!attributes.TargetAttributes[targetUuid]) {
      attributes.TargetAttributes[targetUuid] = {};
    }

    // Add Push Notifications capability
    attributes.TargetAttributes[targetUuid].SystemCapabilities = {
      "com.apple.Push": { enabled: 1 },
    };

    return config;
  });
};
