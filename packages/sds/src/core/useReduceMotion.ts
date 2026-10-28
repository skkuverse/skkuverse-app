/**
 * QUIRK(react-native-reanimated): `useReducedMotion()` is read once when its runtime starts, so a Settings change reaches it only after a relaunch;
 * this starts from it and then follows `AccessibilityInfo`, which reports the change on both platforms.
 */
import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, type EmitterSubscription } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

let live: boolean | null = null;
let subscription: EmitterSubscription | null = null;
const listeners = new Set<() => void>();

function publish(enabled: boolean) {
  if (live === enabled) return;
  live = enabled;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (subscription === null) {
    subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', publish);
    AccessibilityInfo.isReduceMotionEnabled().then(publish, () => {});
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      subscription?.remove();
      subscription = null;
    }
  };
}

function getSnapshot(): boolean | null {
  return live;
}

export function useReduceMotion(): boolean {
  const atLaunch = useReducedMotion();
  return useSyncExternalStore(subscribe, getSnapshot) ?? atLaunch;
}
