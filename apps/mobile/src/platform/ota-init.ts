import { HotUpdater, insights } from '@hot-updater/react-native';
import { OTA_BASE_URL, OTA_CLIENT_API_KEY } from '../../config/constants';

/**
 * QUIRK(hot-updater): `init` runs at module load, outside every error boundary, and only reports the
 * launch (`notifyAppReady` drives crash rollback); checking and reloading stay manual.
 * WHY: `insights()` feeds the console's release health; no user id is attached (`setUser` is never called).
 */
HotUpdater.init({
  baseURL: OTA_BASE_URL,
  requestHeaders: { 'x-api-key': OTA_CLIENT_API_KEY },
  plugins: [insights()],
});
