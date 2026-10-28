import { StyleSheet } from 'react-native';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { ResultSection } from '@skkuverse/sds';
import type { ReactNode } from 'react';
import { TossfaceRuns } from '@/components/TossfaceRuns';

interface StatusCardProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  onRetry?: () => void;
}

export function StatusCard({ icon, title, subtitle, onRetry }: StatusCardProps) {
  const { t } = useT();
  return (
    <ResultSection
      size="medium"
      asset={icon}
      title={title}
      description={subtitle ? <TossfaceRuns text={subtitle} /> : undefined}
      primaryActionProps={onRetry ? { children: t('common.retry'), onPress: onRetry } : undefined}
      style={styles.container}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 0,
    paddingVertical: SdsSpacing.x14,
  },
});
