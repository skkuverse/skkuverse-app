import { useT } from '@skkuverse/shared';
import { isGateOpen } from '@/platform/ota';
import { MapSheetStack } from '../MapSheetStack';
import { useMapTab } from '../useMapTab';
import { ThisWeekSheet } from './components/ThisWeekSheet';
import { mapRootSheetOf } from './this-week.rules';

// WHY: the build's channel never changes while it runs.
const ROOT = mapRootSheetOf(isGateOpen('thisWeekSheet'));

export function ThisWeekMapTab() {
  const { t } = useT();
  useMapTab();
  return (
    <MapSheetStack
      tab="map"
      root={{ profile: 'thisWeekRoot', label: t(ROOT.label), body: ROOT.body === 'feed' ? <ThisWeekSheet /> : null }}
    />
  );
}
