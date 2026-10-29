import { uuid } from 'expo-modules-core';
import { createMMKV } from 'react-native-mmkv';

// WHY: this id, not the FCM token, keys `devices/{deviceId}` in Firestore: the OS may refresh a token at
// any time, while this id lasts until the app is reinstalled.

const DEVICE_ID_KEY = 'device_id';
const mmkv = createMMKV({ id: 'skkubus-device' });

let cached: string | null = null;

export function getOrCreateDeviceId(): string {
  if (cached) return cached;

  const existing = mmkv.getString(DEVICE_ID_KEY);
  if (existing) {
    cached = existing;
    return existing;
  }

  // WHY: no one else should be able to guess this id, so it comes from the OS's secure generator, never
  // `Math.random`. The native UUID ships in every build, so an OTA update can carry it.
  const id = uuid.v4();
  mmkv.set(DEVICE_ID_KEY, id);
  cached = id;
  return id;
}
