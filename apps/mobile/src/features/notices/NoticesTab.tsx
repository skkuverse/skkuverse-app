import { Stack } from 'expo-router';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { NoticesTabScreen } from './NoticesTabScreen';
import { OnboardingLanding } from './components/OnboardingLanding';
import { NoticesSearchFallbackBar } from './components/NoticesSearchFallbackBar';
import { useNoticesTab } from './useNoticesTab';

// WHY: false off iOS 26 and on Android, where NativeTabs and its bottom accessory are not in play.
const GLASS_AVAILABLE = isLiquidGlassAvailable();

export function NoticesTab() {
  const { showsLanding, openOnboarding, handleExistingAccountSignIn, signingIn, signInError } =
    useNoticesTab();

  // QUIRK(react-navigation): inline setOptions is sticky, so both branches set `headerShown`; the gate
  // must unmount the header, since a native-stack header sits in its own layer no overlay covers.
  if (showsLanding) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <OnboardingLanding
          onStartPress={openOnboarding}
          onExistingAccountPress={handleExistingAccountSignIn}
          loading={signingIn}
          signInError={signInError}
        />
      </>
    );
  }

  // WHY: the fallback bar is the search entry where no bottom accessory exists; on iOS 26 it never mounts,
  // so the list stays RNSScreen's first subview.
  return (
    <>
      <Stack.Screen options={{ headerShown: true }} />
      <NoticesTabScreen />
      {!GLASS_AVAILABLE && <NoticesSearchFallbackBar />}
    </>
  );
}
