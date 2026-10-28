import { createMMKV } from 'react-native-mmkv';

// WHY: this id, not the FCM token, keys `devices/{deviceId}` in Firestore: the OS may refresh a token at
// any time, while this id lasts until the app is reinstalled.

const DEVICE_ID_KEY = 'device_id';
const mmkv = createMMKV({ id: 'skkubus-device' });

let cached: string | null = null;

/** WHY: an identifier, not a secret, so `Math.random` suffices. */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getOrCreateDeviceId(): string {
  if (cached) return cached;

  const existing = mmkv.getString(DEVICE_ID_KEY);
  if (existing) {
    cached = existing;
    return existing;
  }

  const id = generateUUID();
  mmkv.set(DEVICE_ID_KEY, id);
  cached = id;
  return id;
}
