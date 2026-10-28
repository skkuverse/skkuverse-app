/**
 * Notification Service Extension. iOS runs it for every alert that carries
 * `mutable-content: 1` (every notice and mini-app push since 2026-10), and it reports the delivery
 * to BigQuery `firebase_messaging.data`. That is the only way to count iOS
 * receipts: the Firebase console shows received counts for Android alone.
 * docs/explanation/fcm-architecture.md, "Delivery and open metrics".
 *
 * @type {import('@bacons/apple-targets/app.plugin').Config}
 */
module.exports = {
  type: "notification-service",
  // The plugin defaults to 18.0, where devices on iOS 16.4–17 would never run
  // the extension and their receipts would go uncounted. Matches the app's
  // floor (expo-build-properties in app.config.ts).
  deploymentTarget: "16.4",
  // FirebaseMessaging reports the delivery under this id minus its last
  // component, so it must stay `<app bundle id>.<one segment>` to be counted
  // as the app.
  bundleIdentifier: ".NotificationService",
};
