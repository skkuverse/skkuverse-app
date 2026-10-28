import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Alert, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import {
  useAuthStore,
  useSettingsStore,
  useT,
  withRetry,
} from '@skkuverse/shared';
import { logHandledError } from '@/platform/crashlytics';
import { requireSession } from '@/features/auth/auth.service';
import {
  answersOf,
  initialSetup,
  missingSteps,
  prefillFromDevice,
  setupReducer,
  type ProfileStep,
  type SetupAction,
  type UserProfile,
} from './profile.rules';
import { getProfileFresh, saveProfile } from './profile.repository';

type Loaded = { profile: UserProfile | null; steps: ProfileStep[] };

const SAVE_TIMEOUT_MS = 12_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      },
    );
  });
}

export function useProfileSetup(requireNickname: boolean) {
  const router = useRouter();
  const uid = useAuthStore((s) => s.uid);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!uid) {
      router.back();
      return;
    }
    let live = true;
    getProfileFresh(uid)
      .then((profile) => live && setLoaded({ profile, steps: missingSteps(profile, { requireNickname }) }))
      .catch((err) => {
        logHandledError('profile/setup-read', err);
        if (live) router.back();
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- what to ask is decided once per user, from the server's copy
  }, [uid]);

  return { uid, loaded };
}

export function useSetupFlow({ uid, profile, steps }: { uid: string; profile: UserProfile | null; steps: ProfileStep[] }) {
  const router = useRouter();
  const { t } = useT();
  const [s, dispatch] = useReducer(setupReducer, undefined, () =>
    initialSetup(steps, {
      nickname: profile?.nickname ?? null,
      prefill: prefillFromDevice(useSettingsStore.getState()),
    }),
  );
  const [saving, setSaving] = useState(false);
  // WHY: guards every way out (CTA, skip, keyboard return, back) during a save, so the screen closes once.
  const busy = useRef(false);

  const isFirst = s.current === s.steps[0];
  const isLast = s.current === s.steps[s.steps.length - 1];

  const save = async (answers: Partial<UserProfile>) => {
    if (busy.current) return;
    const session = requireSession();
    if ('reason' in session) {
      Alert.alert(t(session.messageKey));
      return;
    }
    // WHY: another uid signed in meanwhile has its own profile, so close rather than write under it.
    if (session.uid !== uid) {
      router.back();
      return;
    }
    busy.current = true;
    setSaving(true);
    try {
      // WHY: a write only resolves when the server answers, never offline, and a spinner must not trap the player.
      await withTimeout(withRetry(() => saveProfile(uid, answers)), SAVE_TIMEOUT_MS);
      router.back();
    } catch (err) {
      logHandledError('profile/save', err);
      Alert.alert(t('profile.saveError'));
      busy.current = false;
      setSaving(false);
    }
  };

  useEffect(() => {
    if (s.current === 'done') router.back();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- checks once, on mount: nothing to ask closes the screen
  }, []);

  // WHY: the move that would finish the flow saves instead, so a failed save leaves the player on the last question.
  const advance = (action: SetupAction) => {
    if (busy.current) return;
    const nextState = setupReducer(s, action);
    if (nextState.current === 'done' && nextState !== s) void save(answersOf(nextState));
    else dispatch(action);
  };

  const back = useCallback(() => {
    if (busy.current) return true;
    if (isFirst) router.back();
    else dispatch({ type: 'PREV' });
    return true;
  }, [isFirst, router]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', back);
    return () => sub.remove();
  }, [back]);

  const next = () => advance({ type: 'NEXT' });

  return { s, dispatch, saving, isLast, back, next };
}
