import * as Location from 'expo-location';

export function getForegroundLocationPermission() {
  return Location.getForegroundPermissionsAsync();
}

export function requestForegroundLocationPermission() {
  return Location.requestForegroundPermissionsAsync();
}

const LAST_KNOWN_MAX_AGE_MS = 5 * 60_000;

/**
 * QUIRK(expo-location): asking for a fix with services off raises iOS's "turn on Location Services"
 * alert, and `mayShowUserSettingsDialog` defaults to true, which raises Android's location dialog.
 */
export async function getFixWithoutPrompt(timeoutMs: number): Promise<{ latitude: number; longitude: number } | null> {
  const permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) return null;
  if (!(await Location.hasServicesEnabledAsync())) return null;
  const last = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS });
  if (last) return last.coords;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    const fresh = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, mayShowUserSettingsDialog: false }),
      timeout,
    ]);
    return fresh?.coords ?? null;
  } finally {
    clearTimeout(timer);
  }
}
