import { PauseCircleIcon } from 'phosphor-react-native';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { useSemanticColors } from '@skkuverse/sds';
import { StatusCard } from './StatusCard';

interface SuspendedCardProps {
  resumeDate?: string;
  message?: string;
}

export function SuspendedCard({ resumeDate, message }: SuspendedCardProps) {
  const { t, tpl } = useT();
  const color = useSemanticColors();
  return (
    <StatusCard
      icon={<PauseCircleIcon size={SdsSpacing.x10} color={color.fg.warning} />}
      title={t('schedule.suspended')}
      subtitle={
        message ??
        (resumeDate ? tpl('schedule.resumeDate', resumeDate) : undefined)
      }
    />
  );
}
