import { useLocalSearchParams } from 'expo-router';
import { SHELL } from '@/bootstrap/shell.service';
import { BusRealtimeScreen } from '@/features/transit/realtime/BusRealtimeScreen';
import { TransitLineRedirect } from '@/features/transit/TransitLineRedirect';

// WHY: the redirect lives in the route, not the action handler, because the places panel pushes this path directly.
// SEE: docs/explanation/shared-map.md
const Realtime = SHELL === 'shared-map' ? TransitLineRedirect : BusRealtimeScreen;

export default function RealtimeRoute() {
  const { groupId, source } = useLocalSearchParams<{ groupId: string; source?: string }>();
  return <Realtime groupId={groupId} source={source} />;
}
