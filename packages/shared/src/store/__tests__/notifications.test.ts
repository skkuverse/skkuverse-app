import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DEFAULT_PREFERENCES, useNotificationStore } from '../notifications';

vi.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: () => null,
    set: () => {},
    remove: () => {},
  }),
}));

describe('useNotificationStore.resetPreferences', () => {
  beforeEach(() => {
    useNotificationStore.setState({ preferences: DEFAULT_PREFERENCES });
  });

  // C7: after a uid change the previous account's subscription must not be
  // shown as this one's while the new listener has yet to deliver.
  it('drops the previous account\'s preferences', () => {
    useNotificationStore.getState().setPreferences({
      ...DEFAULT_PREFERENCES,
      enabled: true,
      miniAppSelections: ['eskara-2026'],
    });
    useNotificationStore.getState().resetPreferences();
    const p = useNotificationStore.getState().preferences;
    expect(p.enabled).toBe(false);
    expect(p.miniAppSelections).toBeUndefined();
  });

  it('keeps the essential lock on in the default', () => {
    expect(DEFAULT_PREFERENCES.categoryEnabled.essential).toBe(true);
  });
});
