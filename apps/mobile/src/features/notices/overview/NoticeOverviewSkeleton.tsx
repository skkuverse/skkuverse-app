import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useT, SdsSpacing, withAlpha } from '@skkuverse/shared';
import { Skeleton, Txt, createThemedStyles } from '@skkuverse/sds';

/** EVIDENCE: a cache hit answers in about 0.3 s, so only a wait past this earns words. */
const STATUS_DELAY_MS = 1000;

/** WHY: mounted only while pending, so the status timer starts afresh for every submitted query. */
export function NoticeOverviewSkeleton() {
  const { t } = useT();
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setShowStatus(true), STATUS_DELAY_MS);
    return () => clearTimeout(id);
  }, []);

  const lines = (
    <View style={styles.lines}>
      <Skeleton width="92%" height={12} style={styles.line} />
      <Skeleton width="100%" height={12} style={styles.line} />
      <Skeleton width="64%" height={12} style={styles.line} />
    </View>
  );

  return (
    <View>
      {reduceMotion ? lines : <Skeleton.Animate>{lines}</Skeleton.Animate>}
      {showStatus ? (
        // WHY: not announced; the card is marked busy, and the answer is announced when it lands.
        <Txt
          typography="t2"
          color="neutralSubtle"
          style={styles.status}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {t('notices.overview.pending')}
        </Txt>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  lines: {
    gap: SdsSpacing.x2,
  },
  line: {
    // WHY: a faint AI green, so the placeholder belongs to the green-edged card.
    backgroundColor: withAlpha(color.fg.ai, 0.1),
  },
  status: {
    marginTop: SdsSpacing.x2,
  },
}));
