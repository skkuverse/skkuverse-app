// WHY: module state, since `+native-intent` runs outside the React tree in the same bundle.

import { createPendingSlot } from '@skkuverse/shared';
import { devLog } from '@/platform/dev-log';
import type { TransitSheetRequest } from './transit.types';

export type PendingTransitSheet = TransitSheetRequest;

export const transitSheetQueue = createPendingSlot<PendingTransitSheet>({
  name: 'pendingTransitSheet',
  log: devLog,
  describe: (request) => ({ kind: request.kind }),
});
