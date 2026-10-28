import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSettingsStore } from '../settings';

// Mock react-native-mmkv: native 모듈이라 Node 환경에서 import 자체가 실패.
// vi.mock은 vitest가 자동 hoist하므로 import 뒤에 둬도 적용 시점이 import
// 평가 전 — eslint import/first 경고 회피하면서 동일 효과.
vi.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: () => null,
    set: () => {},
    remove: () => {},
  }),
}));

const initialState = {
  preferredCampus: 'hssc' as const,
  appLanguage: 'ko' as const,
  lastTab: 'notices' as const,
  onboardingCompleted: false,
  primaryDeptId: null,
  interestDeptIds: [],
  seen: {},
  miniAppOptIns: [],
  pendingMiniAppOptIns: [],
};

describe('useSettingsStore.restoreOnboardingFromRemote', () => {
  beforeEach(() => {
    // Reset state fields to default. Note: NOT replace=true — that would
    // also wipe the action functions registered in store definition.
    useSettingsStore.setState(initialState);
  });

  it('fresh restore: sets primaryDept/interest + onboardingCompleted=true', () => {
    useSettingsStore.getState().restoreOnboardingFromRemote({
      primaryDeptId: 'cs',
      interestDeptIds: ['ee', 'me'],
    });
    const s = useSettingsStore.getState();
    expect(s.onboardingCompleted).toBe(true);
    expect(s.primaryDeptId).toBe('cs');
    expect(s.interestDeptIds).toEqual(['ee', 'me']);
  });

  it('dual-write race-free: same data twice → final state identical', () => {
    // 본 PR 시나리오 E — 인라인 핸들러 호출 + listener 발화의 중복 호출.
    const data = { primaryDeptId: 'cs', interestDeptIds: ['ee'] };
    useSettingsStore.getState().restoreOnboardingFromRemote(data);
    useSettingsStore.getState().restoreOnboardingFromRemote(data);
    const s = useSettingsStore.getState();
    expect(s.onboardingCompleted).toBe(true);
    expect(s.primaryDeptId).toBe('cs');
    expect(s.interestDeptIds).toEqual(['ee']);
  });

  it('account-switch: always-overwrite replaces previous values', () => {
    // 본 PR 시나리오 F — A 로그인 → logout → B 단축경로. idempotency
    // guard가 있었다면 A의 'cs'가 sticky하게 남음 (silent breach).
    useSettingsStore.getState().restoreOnboardingFromRemote({
      primaryDeptId: 'cs',
      interestDeptIds: ['ee'],
    });
    useSettingsStore.getState().restoreOnboardingFromRemote({
      primaryDeptId: 'mech',
      interestDeptIds: ['me', 'ie'],
    });
    const s = useSettingsStore.getState();
    expect(s.primaryDeptId).toBe('mech');
    expect(s.interestDeptIds).toEqual(['me', 'ie']);
  });

  it('does not touch preferredCampus / appLanguage / lastTab', () => {
    // campus는 의도적 미복원 (plan §캠퍼스 미복원 정당화).
    // appLanguage / lastTab도 사용자가 명시 설정한 다른 도메인의 값이라
    // restore가 손대면 안 됨.
    useSettingsStore.getState().setPreferredCampus('nsc');
    useSettingsStore.getState().setAppLanguage('en');
    useSettingsStore.getState().setLastTab('home');

    useSettingsStore.getState().restoreOnboardingFromRemote({
      primaryDeptId: 'cs',
      interestDeptIds: [],
    });

    const s = useSettingsStore.getState();
    expect(s.preferredCampus).toBe('nsc');
    expect(s.appLanguage).toBe('en');
    expect(s.lastTab).toBe('home');
    expect(s.onboardingCompleted).toBe(true);
    expect(s.primaryDeptId).toBe('cs');
  });
});

describe('useSettingsStore.markSeen', () => {
  beforeEach(() => {
    useSettingsStore.setState(initialState);
  });

  it('starts with nothing seen', () => {
    expect(useSettingsStore.getState().seen).toEqual({});
  });

  it('adds a key without dropping the others', () => {
    useSettingsStore.getState().markSeen('intro');
    useSettingsStore.getState().markSeen('eskaraWhatsNew');
    expect(useSettingsStore.getState().seen).toEqual({ intro: true, eskaraWhatsNew: true });
  });

  it('does not unlock the notices gate', () => {
    // seen.intro와 onboardingCompleted는 서로 다른 게이트다. 인트로를 건너뛴
    // 사용자는 여전히 공지 탭에서 위저드를 거쳐야 한다.
    useSettingsStore.getState().markSeen('intro');
    expect(useSettingsStore.getState().onboardingCompleted).toBe(false);
  });

  it('survives resetUserScopedState — it is device UI state, not user data', () => {
    // 회원 탈퇴 후 익명으로 돌아가도 인트로를 다시 보여주지 않는다.
    useSettingsStore.getState().markSeen('intro');
    useSettingsStore.getState().resetUserScopedState();
    const s = useSettingsStore.getState();
    expect(s.seen.intro).toBe(true);
    expect(s.onboardingCompleted).toBe(false);
  });
});

describe('useSettingsStore migrate v4 → v5', () => {
  const migrate = (persisted: Record<string, unknown>) =>
    useSettingsStore.persist.getOptions().migrate!(persisted, 4) as unknown as Record<string, unknown>;

  it('keeps a seen intro', () => {
    const s = migrate({ lastTab: 'campus', introSeen: true });
    expect(s.seen).toEqual({ intro: true });
    expect(s).not.toHaveProperty('introSeen');
    expect(s.lastTab).toBe('campus');
  });

  it('keeps an unseen intro unseen', () => {
    expect(migrate({ introSeen: false }).seen).toEqual({});
  });

  it('tours an install that predates introSeen', () => {
    expect(migrate({ lastTab: 'home' }).seen).toEqual({});
  });
});

describe('useSettingsStore.miniAppOptIns — this device opted into a mini app\'s push', () => {
  beforeEach(() => {
    useSettingsStore.setState(initialState);
  });

  it('starts empty', () => {
    expect(useSettingsStore.getState().miniAppOptIns).toEqual([]);
  });

  it('adds an id once, however often it is set', () => {
    useSettingsStore.getState().setMiniAppOptIn('eskara-2026', true);
    useSettingsStore.getState().setMiniAppOptIn('eskara-2026', true);
    expect(useSettingsStore.getState().miniAppOptIns).toEqual(['eskara-2026']);
  });

  it('removes only the id turned off', () => {
    useSettingsStore.getState().setMiniAppOptIn('eskara-2026', true);
    useSettingsStore.getState().setMiniAppOptIn('inja', true);
    useSettingsStore.getState().setMiniAppOptIn('eskara-2026', false);
    expect(useSettingsStore.getState().miniAppOptIns).toEqual(['inja']);
  });

  it('survives resetUserScopedState — it follows the device across a sign-out', () => {
    useSettingsStore.getState().setMiniAppOptIn('eskara-2026', true);
    useSettingsStore.getState().resetUserScopedState();
    expect(useSettingsStore.getState().miniAppOptIns).toEqual(['eskara-2026']);
  });

  it('clearMiniAppOptIns empties it — account deletion forgets the choice', () => {
    useSettingsStore.getState().setMiniAppOptIn('eskara-2026', true);
    useSettingsStore.getState().clearMiniAppOptIns();
    expect(useSettingsStore.getState().miniAppOptIns).toEqual([]);
  });

  it('records eskaraPushAsk as a seen key', () => {
    useSettingsStore.getState().markSeen('eskaraPushAsk');
    expect(useSettingsStore.getState().seen.eskaraPushAsk).toBe(true);
  });
});

describe('useSettingsStore.pendingMiniAppOptIns', () => {
  beforeEach(() => {
    useSettingsStore.setState(initialState);
  });

  it('marks and clears one id', () => {
    useSettingsStore.getState().setMiniAppOptInPending('eskara-2026', true);
    useSettingsStore.getState().setMiniAppOptInPending('eskara-2026', true);
    expect(useSettingsStore.getState().pendingMiniAppOptIns).toEqual(['eskara-2026']);
    useSettingsStore.getState().setMiniAppOptInPending('eskara-2026', false);
    expect(useSettingsStore.getState().pendingMiniAppOptIns).toEqual([]);
  });

  it('account deletion clears pending opt-ins too', () => {
    useSettingsStore.getState().setMiniAppOptIn('eskara-2026', true);
    useSettingsStore.getState().setMiniAppOptInPending('eskara-2026', true);
    useSettingsStore.getState().clearMiniAppOptIns();
    expect(useSettingsStore.getState().pendingMiniAppOptIns).toEqual([]);
  });
});

describe('useSettingsStore.subwayChoices — the line and directions picked per station', () => {
  beforeEach(() => {
    useSettingsStore.setState({ ...initialState, subwayChoices: {} });
  });

  it('records the line without dropping the directions or other stations', () => {
    // Arrange
    useSettingsStore.getState().setSubwayDirection('jeongja', 'K2', 'down');
    useSettingsStore.getState().setSubwayLine('gangnam', '2');

    // Act
    useSettingsStore.getState().setSubwayLine('jeongja', 'D1');

    // Assert
    expect(useSettingsStore.getState().subwayChoices).toEqual({
      jeongja: { line: 'D1', direction: { K2: 'down' } },
      gangnam: { line: '2' },
    });
  });

  it("records one line's direction without touching another line's", () => {
    // Arrange
    useSettingsStore.getState().setSubwayDirection('jeongja', 'D1', 'up');
    useSettingsStore.getState().setSubwayLine('jeongja', 'K2');

    // Act
    useSettingsStore.getState().setSubwayDirection('jeongja', 'K2', 'down');

    // Assert
    expect(useSettingsStore.getState().subwayChoices.jeongja).toEqual({
      line: 'K2',
      direction: { D1: 'up', K2: 'down' },
    });
  });

  it('survives resetUserScopedState — it is device UI state, not user data', () => {
    // Arrange
    useSettingsStore.getState().setSubwayLine('jeongja', 'K2');

    // Act
    useSettingsStore.getState().resetUserScopedState();

    // Assert
    expect(useSettingsStore.getState().subwayChoices).toEqual({ jeongja: { line: 'K2' } });
  });

  it('a stored v5 payload without the field hydrates to no choices, without a migration', () => {
    // Arrange
    const options = useSettingsStore.persist.getOptions();
    const persisted = { lastTab: 'transit', transitGroupStates: { 'group:x': 'expanded' } };

    // Act
    const merged = options.merge!(persisted, useSettingsStore.getInitialState());

    // Assert
    expect(options.version).toBe(5);
    expect(merged.subwayChoices).toEqual({});
    expect(merged.lastTab).toBe('transit');
  });
});
