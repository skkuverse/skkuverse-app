import { Stack } from 'expo-router';
import { useDefaultHeaderOptions } from '@/components/useDefaultHeaderOptions';

export default function HomeStackLayout() {
  const headerOptions = useDefaultHeaderOptions();
  return <Stack screenOptions={headerOptions} />;
}
