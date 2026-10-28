import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { GameScreen } from '@/features/games/host/GameScreen';
import { isGameId } from '@/features/games/games.constants';
import { useGamePage } from '@/features/games/useGameExposure';
import { asEntrySource } from '@/platform/analytics.rules';

// QUIRK(react-native-safe-area-context): a modal mounts in its own UIViewController and the root
// SafeAreaProvider measures the root one, so its first paint loses the top inset. It re-mounts that
// provider and the sheet provider, since a sheet portalled to the root provider draws under the modal.
export default function GameRoute() {
  const { id, source } = useLocalSearchParams<{ id: string; source?: string }>();
  const page = useGamePage(id);
  if (!id || !isGameId(id) || !page) {
    return <Redirect href="/(tabs)/home" />;
  }
  return (
    <SafeAreaProvider>
      <BottomSheetModalProvider>
        <GameScreen gameId={id} page={page} source={asEntrySource(source)} />
      </BottomSheetModalProvider>
    </SafeAreaProvider>
  );
}
