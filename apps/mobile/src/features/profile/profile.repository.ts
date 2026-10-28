import {
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from '@react-native-firebase/firestore';
import { primeAppCheck } from '@/platform/app-check';
import { parseProfile, type UserProfile } from './profile.rules';

// WHY: writes merge into the map, so a caller sends only what it answers; `updatedAt` is always the server's.
const userRef = (uid: string) => doc(getFirestore(), 'users', uid);

export function watchProfile(
  uid: string,
  onChange: (profile: UserProfile | null) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    userRef(uid),
    (snap) => onChange(parseProfile(snap.data())),
    onError,
  );
}

export async function getProfile(uid: string): Promise<UserProfile | null> {
  return parseProfile((await getDoc(userRef(uid))).data());
}

/**
 * WHY: for deciding what to ask; a stale cached document would ask it all again
 * and overwrite another device's answers, so the server's copy comes first.
 */
export async function getProfileFresh(uid: string): Promise<UserProfile | null> {
  try {
    return await getProfileFromServer(uid);
  } catch {
    return getProfile(uid);
  }
}

export async function getProfileFromServer(uid: string): Promise<UserProfile | null> {
  return parseProfile((await getDocFromServer(userRef(uid))).data());
}

export async function saveProfile(uid: string, patch: Partial<UserProfile>): Promise<void> {
  await primeAppCheck();
  await setDoc(
    userRef(uid),
    { profile: { ...patch, updatedAt: serverTimestamp() } },
    { merge: true },
  );
}
