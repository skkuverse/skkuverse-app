import { StyleSheet } from 'react-native';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { ResultSection } from '@skkuverse/sds';

interface Props {
  message: string;
  onRetry?: () => void;
}

/** WHY: one line, so it is the section's description, as on the game boards (RESULT-01). */
export function NoticeEmptyState({ message, onRetry }: Props) {
  const { t } = useT();
  return (
    <ResultSection
      size="medium"
      description={message}
      primaryActionProps={onRetry ? { children: t('notices.retry'), onPress: onRetry } : undefined}
      style={styles.container}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: SdsSpacing.x16,
  },
});
