import { useLocalSearchParams } from 'expo-router';
import { MiniAppShellScreen } from '@/features/web/shell/MiniAppShellScreen';

export default function MiniAppRoute() {
  const { id, path, source } = useLocalSearchParams<{ id?: string; path?: string; source?: string }>();
  return <MiniAppShellScreen id={id} path={path} source={source} />;
}
