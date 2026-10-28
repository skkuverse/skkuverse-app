import { InfoIcon } from 'phosphor-react-native';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { useSemanticColors } from '@skkuverse/sds';
import { StatusCard } from './StatusCard';

export function NoDataCard() {
  const color = useSemanticColors();
  const { t } = useT();
  return (
    <StatusCard
      icon={<InfoIcon size={SdsSpacing.x10} color={color.fg.placeholder} />}
      title={t('schedule.noScheduleData')}
    />
  );
}
