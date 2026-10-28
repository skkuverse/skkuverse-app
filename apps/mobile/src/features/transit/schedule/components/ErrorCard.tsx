import { WarningCircleIcon } from 'phosphor-react-native';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { useSemanticColors } from '@skkuverse/sds';
import { StatusCard } from './StatusCard';

interface ErrorCardProps {
  onRetry?: () => void;
}

export function ErrorCard({ onRetry }: ErrorCardProps) {
  const color = useSemanticColors();
  const { t } = useT();
  return (
    <StatusCard
      icon={<WarningCircleIcon size={SdsSpacing.x10} color={color.fg.placeholder} />}
      title={t('schedule.dataLoadFailed')}
      subtitle={onRetry ? undefined : t('error.tryLater')}
      onRetry={onRetry}
    />
  );
}
