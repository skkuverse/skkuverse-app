import { useLocalSearchParams } from 'expo-router';
import { ScheduleScreen } from '@/features/transit/schedule/ScheduleScreen';

export default function ScheduleRoute() {
  const { groupId, serviceId: serviceParam, source } = useLocalSearchParams<{
    groupId: string;
    serviceId?: string;
    source?: string;
  }>();
  return <ScheduleScreen groupId={groupId} serviceParam={serviceParam} source={source} />;
}
