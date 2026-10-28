/** WHY: no NotificationDocument: there is no in-app inbox (ADR 0002); unread is a local counter. */
export interface UserDocument {
  // WHY: the server's notification copy supports ko and en only, so a zh user falls back to ko.
  locale: 'ko' | 'en';
}

/**
 * SEE: docs/explanation/fcm-architecture.md ("The principle: what is recorded is intent, what is sent is derived")
 * WHY: the server-side functions keep a hand-kept mirror of this type.
 */
export interface PreferencesDocument {
  enabled: boolean;
  categoryEnabled: CategoryEnabled;
  // WHY: a missing key is on, so a new server tab reaches existing users.
  noticeTabEnabled: Record<string, boolean>;
  pickerSelections: Record<string, string[]>;
  // WHY: its own field, not a pickerSelections key, which mirrors the server's notice categories in a
  // cross-repo contract; still gated by `enabled`, not by `categoryEnabled.notices`.
  miniAppSelections?: string[];

  /**
   * WHY: moves once, null to a timestamp: the client sets it only while the stored value is null.
   * SEE: docs/explanation/fcm-architecture.md ("The `onboardedAt` discriminator")
   */
  onboardedAt: unknown | null;

  // WHY: written by the backend only; Timestamps are `unknown` to keep Firestore SDK types out.
  subscribedTopics: string[];
  derivedAt: unknown | null;
}

export interface CategoryEnabled {
  essential: boolean;
  services: boolean;
  notices: boolean;
}

export interface DeviceDocument {
  uid: string;
  token: string;
  platform: 'ios' | 'android';
  appVersion: string;
  lastActive: Date;
  active: boolean;
  subscribedTopics: string[];
  notificationsEnabled: boolean;
  locale: 'ko' | 'en';
}
