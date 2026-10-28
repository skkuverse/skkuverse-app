import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

// WHY: one OS listener for the whole app, never removed, since the answer is wanted for the life of the
// process; it reads false until the OS answers, a moment after launch.
let enabled = false;
let started = false;
const listeners = new Set<() => void>();

function update(next: boolean): void {
  if (next === enabled) return;
  enabled = next;
  listeners.forEach((listener) => {
    listener();
  });
}

function subscribe(listener: () => void): () => void {
  if (!started) {
    started = true;
    AccessibilityInfo.addEventListener('screenReaderChanged', update);
    AccessibilityInfo.isScreenReaderEnabled().then(update, () => {});
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const read = () => enabled;

export function useScreenReader(): boolean {
  return useSyncExternalStore(subscribe, read);
}
