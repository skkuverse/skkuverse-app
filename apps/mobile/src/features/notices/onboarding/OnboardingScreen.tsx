import { StyleSheet, View } from 'react-native';
import { Button, Loader, ResultSection } from '@skkuverse/sds';
import { useT, type Campus } from '@skkuverse/shared';
import { GoogleIcon } from '@/components/GoogleIcon';
import { OnboardingLayout } from '@/components/OnboardingLayout';
import { CampusStep } from '@/features/profile/CampusStep';
import { PrimaryDeptStep } from './components/PrimaryDeptStep';
import { InterestDeptStep } from './components/InterestDeptStep';
import { LoginStep } from './components/LoginStep';
import { NotificationStep } from './components/NotificationStep';
import { NoticeCategoriesStep } from './components/NoticeCategoriesStep';
import { CompletionStep } from './components/CompletionStep';
import { ExitDialog } from './components/ExitDialog';
import { useOnboarding } from './useOnboarding';

export function OnboardingScreen() {
  const { t } = useT();
  const {
    state,
    dispatch,
    tabsLoading,
    tabsError,
    refetchTabs,
    deptList,
    loginLoading,
    loginError,
    showExitDialog,
    setShowExitDialog,
    handleBack,
    handleLeave,
    handleSignIn,
    handleSkipInterests,
    handleSkipNotifications,
    handleUnsupportedDept,
    ctaDisabled,
    ctaLabel,
    onCtaPress,
  } = useOnboarding();

  const renderStep = () => {
    // WHY: steps 2 to 4 wait for the department list, so no one completes onboarding with an empty selection.
    const needsDeptData = state.step >= 2 && state.step <= 4;
    if (needsDeptData && tabsLoading && deptList.length === 0) {
      return (
        <View style={stepStyles.placeholder}>
          <Loader size="medium" tone="neutral" delay={700} />
        </View>
      );
    }
    if (needsDeptData && tabsError && deptList.length === 0) {
      return (
        <ResultSection
          size="medium"
          description={t('notifications.loadError')}
          primaryActionProps={{ children: t('notifications.retry'), onPress: () => refetchTabs() }}
        />
      );
    }

    switch (state.step) {
      case 1:
        return (
          <CampusStep
            selected={state.campus}
            onSelect={(campus: Campus) => dispatch({ type: 'SET_CAMPUS', campus })}
          />
        );
      case 2:
        return (
          <PrimaryDeptStep
            campus={state.campus!}
            sources={deptList}
            selectedId={state.primaryDeptId}
            onSelect={(deptId: string) => dispatch({ type: 'SET_PRIMARY_DEPT', deptId })}
          />
        );
      case 3:
        return (
          <InterestDeptStep
            campus={state.campus!}
            primaryDeptId={state.primaryDeptId}
            sources={deptList}
            selectedIds={state.interestDeptIds}
            onToggle={(deptId: string) => dispatch({ type: 'TOGGLE_INTEREST_DEPT', deptId })}
          />
        );
      case 4:
        return (
          <LoginStep
            campus={state.campus!}
            primaryDeptId={state.primaryDeptId}
            interestDeptIds={state.interestDeptIds}
            sources={deptList}
            loginError={loginError}
          />
        );
      case 5:
        return <NotificationStep />;
      case 6:
        return <NoticeCategoriesStep />;
      case 7:
        return <CompletionStep userName={state.userName ?? ''} />;
    }
  };

  return (
    <>
      <OnboardingLayout
        backLabel="뒤로"
        onBack={handleBack}
        ctaLabel={ctaLabel}
        ctaDisabled={ctaDisabled}
        onCtaPress={onCtaPress}
        minimal={state.step === 7}
        ctaContent={
          state.step === 4
            ? (
                <Button
                  tone="neutral"
                  size="large"
                  display="block"
                  loading={loginLoading}
                  onPress={handleSignIn}
                  leftAccessory={<GoogleIcon size={20} />}
                >
                  {t('onboarding.loginCta')}
                </Button>
              )
            : undefined
        }
        secondaryAction={
          state.step === 2
            ? { label: t('onboarding.primaryDeptUnsupportedHelp'), onPress: handleUnsupportedDept }
            : state.step === 3
            ? { label: t('onboarding.skip'), onPress: handleSkipInterests }
            : state.step === 5
            ? { label: t('onboarding.notificationSkip'), onPress: handleSkipNotifications }
            : undefined
        }
      >
        {renderStep()}
      </OnboardingLayout>

      <ExitDialog
        open={showExitDialog}
        onContinue={() => setShowExitDialog(false)}
        onLeave={handleLeave}
      />
    </>
  );
}

const stepStyles = StyleSheet.create({
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
