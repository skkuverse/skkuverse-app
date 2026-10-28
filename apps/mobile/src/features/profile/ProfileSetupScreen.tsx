import { View } from 'react-native';
import { useT } from '@skkuverse/shared';
import { OnboardingLayout } from '@/components/OnboardingLayout';
import { CampusStep } from './CampusStep';
import { NicknameStep } from './components/NicknameStep';
import { canAdvance, type ProfileStep, type UserProfile } from './profile.rules';
import { useProfileSetup, useSetupFlow } from './useProfileSetup';
import { Loader, createThemedStyles } from '@skkuverse/sds';

interface Props {
  requireNickname: boolean;
}

export function ProfileSetupScreen({ requireNickname }: Props) {
  const styles = useStyles();
  const { uid, loaded } = useProfileSetup(requireNickname);

  if (!loaded || !uid) {
    return (
      <View style={styles.center}>
        <Loader size="medium" tone="neutral" delay={700} />
      </View>
    );
  }
  return <SetupFlow uid={uid} profile={loaded.profile} steps={loaded.steps} />;
}

function SetupFlow({ uid, profile, steps }: { uid: string; profile: UserProfile | null; steps: ProfileStep[] }) {
  const styles = useStyles();
  const { t } = useT();
  const { s, dispatch, saving, isLast, back, next } = useSetupFlow({ uid, profile, steps });

  const renderStep = () => {
    switch (s.current) {
      case 'campus':
        return (
          <CampusStep
            selected={s.campus}
            onSelect={(campus) => dispatch({ type: 'SET_CAMPUS', campus })}
            subtitle={t('profile.campusSubtitle')}
            track={false}
          />
        );
      case 'nickname':
        return (
          <NicknameStep
            value={s.nickname}
            onChange={(nickname) => dispatch({ type: 'SET_NICKNAME', nickname })}
            onSubmit={next}
          />
        );
      case 'done':
        return (
          <View style={styles.center}>
            <Loader size="medium" tone="neutral" delay={700} />
          </View>
        );
    }
  };

  return (
    <OnboardingLayout
      backLabel="뒤로"
      onBack={back}
      ctaLabel={isLast ? t(s.steps.includes('nickname') ? 'profile.register' : 'profile.done') : t('onboarding.next')}
      ctaDisabled={!canAdvance(s) || saving}
      onCtaPress={next}
    >
      {renderStep()}
    </OnboardingLayout>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.bg.layerDefault },
}));
