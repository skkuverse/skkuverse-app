import type { SessionReason } from './anon-session.rules';
import type { SessionReasonMessageKey } from './sign-in-errors.rules';

export interface SessionBlocked {
  reason: SessionReason;
  messageKey: SessionReasonMessageKey;
}

export type SessionRequirement = { uid: string } | SessionBlocked;

export type AuthFlowScope = 'login' | 'notices' | 'onboarding' | 'intro' | 'game';

export type OnboardingClassification =
  | { kind: 'restored' }
  | { kind: 'new' }
  | { kind: 'read-failed' };

export type DeleteAccountFeedback = {
  reasons: string[];
  otherText?: string;
};

export type DeleteAccountResponse = { ok: true };
