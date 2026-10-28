import { SHELL } from '@/bootstrap/shell.service';
import { useTabFocusTracking } from '@/bootstrap/useTabFocusTracking';
import { TransitMapTab } from '@/features/transit/TransitMapTab';
import { TransitTabScreen } from '@/features/transit/TransitTabScreen';

const TabBody = SHELL === 'shared-map' ? TransitMapTab : TransitTabScreen;

export default function TransitTab() {
  useTabFocusTracking('transit');
  return <TabBody />;
}
