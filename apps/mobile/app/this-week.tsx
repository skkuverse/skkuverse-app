import { Redirect } from 'expo-router';
import { ThisWeekScreen } from '@/features/map/this-week/ThisWeekScreen';
import { isGateOpen } from '@/platform/ota';

// WHY: behind the `thisWeekPage` gate; closed, only a path from outside (a server route action) reaches this redirect.
export default function ThisWeekRoute() {
  return isGateOpen('thisWeekPage') ? <ThisWeekScreen /> : <Redirect href="/(tabs)/home" />;
}
