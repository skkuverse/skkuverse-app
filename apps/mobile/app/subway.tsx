import { useLocalSearchParams } from 'expo-router';
import { SHELL } from '@/bootstrap/shell.service';
import { SubwayScreen } from '@/features/transit/subway/SubwayScreen';
import { TransitStationRedirect } from '@/features/transit/TransitStationRedirect';

// WHY: under the shared map a station is a sheet on the transit tab, so this route redirects there.
// SEE: docs/explanation/shared-map.md
const Subway = SHELL === 'shared-map' ? TransitStationRedirect : SubwayScreen;

export default function SubwayRoute() {
  const { station, line: lineParam, source } = useLocalSearchParams<{
    station: string;
    line?: string;
    source?: string;
  }>();
  return <Subway station={station} lineParam={lineParam} source={source} />;
}
