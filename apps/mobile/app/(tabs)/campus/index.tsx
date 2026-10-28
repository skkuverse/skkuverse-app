import { SHELL } from '@/bootstrap/shell.service';
import { useTabFocusTracking } from '@/bootstrap/useTabFocusTracking';
import { NativeMapScreen } from '@/features/map/NativeMapScreen';
import { ThisWeekMapTab } from '@/features/map/this-week/ThisWeekMapTab';

const TabBody = SHELL === 'shared-map' ? ThisWeekMapTab : NativeMapScreen;

export default function CampusTab() {
  useTabFocusTracking('campus');

  return <TabBody />;
}
