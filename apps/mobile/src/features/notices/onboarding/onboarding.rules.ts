import type { OnboardingAction, OnboardingState, OnboardingStep } from './onboarding.types';

/**
 * WHY: a pure rules file so vitest needs no React Native; the skips (3 to 5 and 5 to 3 with `skipLogin`,
 * 7 to 5 when declined) are the only non-±1 steps, and a wrong one strands the user on a dead page.
 */

export const MAX_INTEREST_DEPTS = 4;

export const initialState: OnboardingState = {
  step: 1,
  campus: null,
  primaryDeptId: null,
  interestDeptIds: [],
  userName: null,
  notificationsAccepted: null,
  seededPickerSelections: null,
  skipLogin: false,
};

export function reducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case 'SET_CAMPUS':
      return { ...state, campus: action.campus };

    case 'SET_PRIMARY_DEPT':
      return {
        ...state,
        primaryDeptId: action.deptId,
        interestDeptIds: state.interestDeptIds.filter((id) => id !== action.deptId),
        // WHY: an edit after ACCEPT invalidates the seeded picker, so finalize reassembles from fresh state.
        seededPickerSelections: null,
      };

    case 'SKIP_PRIMARY_DEPT':
      // WHY: the interest picks are kept; only the primary is cleared.
      return { ...state, primaryDeptId: null, seededPickerSelections: null };

    case 'TOGGLE_INTEREST_DEPT': {
      const exists = state.interestDeptIds.includes(action.deptId);
      if (exists) {
        return {
          ...state,
          interestDeptIds: state.interestDeptIds.filter((id) => id !== action.deptId),
          seededPickerSelections: null,
        };
      }
      if (state.interestDeptIds.length >= MAX_INTEREST_DEPTS) return state;
      return {
        ...state,
        interestDeptIds: [...state.interestDeptIds, action.deptId],
        seededPickerSelections: null,
      };
    }

    case 'CLEAR_INTEREST_DEPTS':
      return { ...state, interestDeptIds: [], seededPickerSelections: null };

    case 'SET_USER':
      return { ...state, userName: action.name };

    case 'ACCEPT_NOTIFICATIONS':
      return {
        ...state,
        notificationsAccepted: true,
        seededPickerSelections: action.pickerSelections,
      };

    case 'DECLINE_NOTIFICATIONS':
      return { ...state, notificationsAccepted: false };

    case 'NEXT':
      if (state.step >= 7) return state;
      // WHY: `skipLogin` is frozen at mount; asking a signed-in user to sign in reads as a bug.
      if (state.step === 3 && state.skipLogin) return { ...state, step: 5 };
      return { ...state, step: (state.step + 1) as OnboardingStep };

    case 'PREV':
      if (state.step <= 1) return state;
      // WHY: a declined user was never seeded, so step 6's toggles would fail silently.
      if (state.step === 7 && state.notificationsAccepted === false) {
        return { ...state, step: 5 };
      }
      // WHY: mirrors the NEXT skip; otherwise back from 5 lands on a login page the user never saw.
      if (state.step === 5 && state.skipLogin) return { ...state, step: 3 };
      return { ...state, step: (state.step - 1) as OnboardingStep };

    default:
      return state;
  }
}
