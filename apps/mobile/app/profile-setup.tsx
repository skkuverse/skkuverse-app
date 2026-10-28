import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { ProfileSetupScreen } from '@/features/profile/ProfileSetupScreen';

// QUIRK(react-native-safe-area-context): a modal mounts in its own UIViewController and the root
// SafeAreaProvider measures the root one, so without its own provider the modal's first paint loses
// the top inset (react-navigation/react-navigation#11285).
export default function ProfileSetupRoute() {
  const { nickname } = useLocalSearchParams<{ nickname?: string }>();
  return (
    <SafeAreaProvider>
      <ProfileSetupScreen requireNickname={nickname === '1'} />
    </SafeAreaProvider>
  );
}
