import { createPendingSlot, type MiniAppTarget, type NavigableActionType } from '@skkuverse/shared';
import type { EntrySource } from '@/platform/analytics.rules';
import { devLog } from '@/platform/dev-log';

// WHY: `+native-intent.tsx` runs outside the React tree, so a link waits here until the root layout's consumer can
// navigate.
type PendingMiniAppLink = MiniAppTarget & { via?: EntrySource };

export const miniAppLinkQueue = createPendingSlot<PendingMiniAppLink>({
  name: 'pendingMiniApp',
  log: devLog,
  describe: (p) => ({ id: p.id, path: p.path }),
});

// QUIRK(react-native-firebase): on a quit-state tap `getInitialNotification()` can resolve before the root
// navigator has a key, and a push against it is lost silently, so the action waits here for the consumer.
type PendingSduiAction = { actionType: NavigableActionType; actionValue: string };

export const sduiActionQueue = createPendingSlot<PendingSduiAction>({
  name: 'pendingSduiAction',
  log: devLog,
  describe: (p) => ({ actionType: p.actionType }),
});

// WHY: nothing navigates on a game that does not open, so without the root toast the tap looks dead.
const unopenableGameListeners = new Set<() => void>();

export const unopenableGameSignal = {
  raise() {
    unopenableGameListeners.forEach((cb) => {
      cb();
    });
  },
  subscribe(cb: () => void): () => void {
    unopenableGameListeners.add(cb);
    return () => {
      unopenableGameListeners.delete(cb);
    };
  },
};
