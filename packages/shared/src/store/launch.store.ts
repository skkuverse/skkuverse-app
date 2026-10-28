import { create } from 'zustand';

/**
 * WHY: the tab tree mounts under the splash, so anything that counts an impression waits for it to
 * lift. Every launch starts covered.
 */
export interface LaunchStore {
  splashUp: boolean;
  setSplashUp: (up: boolean) => void;
}

export const useLaunchStore = create<LaunchStore>()((set) => ({
  splashUp: true,
  setSplashUp: (up) => set({ splashUp: up }),
}));
