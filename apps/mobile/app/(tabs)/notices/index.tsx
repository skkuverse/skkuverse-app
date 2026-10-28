import { NoticesTab } from '@/features/notices/NoticesTab';
import { useTabFocusTracking } from '@/bootstrap/useTabFocusTracking';

export default function NoticesTabRoute() {
  useTabFocusTracking('notices');
  return <NoticesTab />;
}
