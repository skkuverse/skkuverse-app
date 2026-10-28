import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { LeaderboardScreen } from '@/features/games/leaderboard/LeaderboardScreen';
import { isGameId } from '@/features/games/games.constants';
import { asEntrySource } from '@/platform/analytics.rules';

// QUIRK(react-native-safe-area-context): a modal mounts in its own UIViewController and the root
// SafeAreaProvider measures the root one, so without its own provider the modal's first paint loses
// the top inset (react-navigation/react-navigation#11285).
export default function LeaderboardRoute() {
  const { id, source } = useLocalSearchParams<{ id: string; source?: string }>();
  if (!id || !isGameId(id)) return <Redirect href="/(tabs)/home" />;
  return (
    <SafeAreaProvider>
      <LeaderboardScreen gameId={id} source={asEntrySource(source)} />
    </SafeAreaProvider>
  );
}
