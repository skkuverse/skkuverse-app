import { useLocalSearchParams } from 'expo-router';
import { RouteDetailScreen } from '@/features/campus-routes/RouteDetailScreen';

export default function RouteDetailRoute() {
  const { routeId, source } = useLocalSearchParams<{ routeId: string; source?: string }>();
  return (
    <RouteDetailScreen
      routeId={typeof routeId === 'string' ? routeId : undefined}
      source={typeof source === 'string' ? source : undefined}
    />
  );
}
