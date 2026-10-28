import { useLocalSearchParams } from 'expo-router';
import { MiniAppFeedScreen } from '@/features/web/feed/MiniAppFeedScreen';

export default function MiniAppFeedRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return null;
  return <MiniAppFeedScreen miniAppId={id} />;
}
