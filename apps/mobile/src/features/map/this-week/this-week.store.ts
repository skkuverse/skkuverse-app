/** WHY: session state, never persisted; switched on a development build only. */

import { create } from 'zustand';
import { THIS_WEEK_DEFAULT_WEEK } from './this-week.constants';
import type { ThisWeekWeekId } from './this-week.types';

interface ThisWeekState {
  weekId: ThisWeekWeekId;
  chooseWeek: (weekId: ThisWeekWeekId) => void;
}

export const useThisWeekStore = create<ThisWeekState>((set) => ({
  weekId: THIS_WEEK_DEFAULT_WEEK,
  chooseWeek: (weekId) => set({ weekId }),
}));
