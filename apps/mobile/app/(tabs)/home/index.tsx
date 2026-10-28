import { Stack } from 'expo-router';
import { HomeScreen } from '@/features/home/HomeScreen';
import { useHomeHeaderOptions } from '@/features/home/useHomeHeaderOptions';
import { useTabFocusTracking } from '@/bootstrap/useTabFocusTracking';

export default function HomeTab() {
  useTabFocusTracking('home');
  const headerOptions = useHomeHeaderOptions();

  return (
    <>
      <Stack.Screen options={headerOptions} />
      <HomeScreen />
    </>
  );
}
