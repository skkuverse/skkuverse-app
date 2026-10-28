/**
 * Custom entry point — registers the FCM background message handler
 * BEFORE expo-router/entry calls AppRegistry.registerComponent.
 *
 * Without this, Android quit-state background messages silently fail
 * because the handler isn't registered early enough.
 * See: https://github.com/invertase/react-native-firebase/discussions/7609
 *
 * The expo-notifications handler decides how a notification is presented while
 * the app is in the foreground, and with none registered nothing is shown: not
 * the FCM banner on iOS (RNFB hands willPresent to expo) nor the copy
 * useNotificationHandler draws on Android. It must exist before the first
 * foreground message, and it must answer within 3 seconds or the notification
 * is dropped, which is why it returns a constant.
 */
import { registerBackgroundMessageHandler, setNotificationHandler } from './src/platform/notifications';
import { backgroundMessageHandler } from './src/bootstrap/background-message.service';
import { initCrashlytics } from './src/platform/crashlytics';

// Before anything else runs, so the Crashlytics JS error handler covers the
// whole launch (see initCrashlytics).
initCrashlytics();
registerBackgroundMessageHandler(backgroundMessageHandler);
setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    // The badge is set explicitly (src/platform/notifications.ts), never from a payload.
    shouldSetBadge: false,
  }),
});

// Expo Router default entry.
//
// Its position here is conventional, NOT load-bearing: Babel's CommonJS
// transform hoists every import's require() above the module body, so
// `require("expo-router/entry")` is evaluated before both calls above no matter
// where this line sits. Verified against this repo's own babel-preset-expo.
// That is harmless — expo-router/entry only hands AppRegistry a component
// factory, and the bundle finishes executing before any task is dispatched, so
// both handlers are registered by the time either can fire.
//
// What actually matters is that the registrations happen at MODULE SCOPE in the
// entry file at all, rather than inside a component. Moving either into React
// is the failure the header describes.
// eslint-disable-next-line import/first -- the handlers above register before the router entry loads
import 'expo-router/entry';
