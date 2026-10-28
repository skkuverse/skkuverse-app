import { useT } from '@skkuverse/shared';
import { Tossface } from '@skkuverse/sds';
import { StatusCard } from './StatusCard';

interface NoServiceCardProps {
  label?: string;
}

export function NoServiceCard({ label }: NoServiceCardProps) {
  const { t } = useT();
  return (
    <StatusCard
      icon={<Tossface size={40}>{'\ud83d\ude8c'}</Tossface>}
      title={t('transit.noService')}
      subtitle={label}
    />
  );
}
