import { Stack } from 'expo-router';
import { useDefaultHeaderOptions } from '@/components/useDefaultHeaderOptions';
import { useNoticesHeaderOptions } from '@/features/notices/useNoticesHeaderOptions';

export default function NoticesTabStackLayout() {
  const headerOptions = useDefaultHeaderOptions();
  const noticesHeaderOptions = useNoticesHeaderOptions();
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen name="index" options={noticesHeaderOptions} />
    </Stack>
  );
}
