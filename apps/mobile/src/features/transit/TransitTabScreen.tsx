
import { Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { BusIcon } from 'phosphor-react-native';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { ResultSection, useSemanticColors, createThemedStyles } from '@skkuverse/sds';
import { ReviewPromptHost } from '@/features/feedback/ReviewPromptHost';
import { TransitSections } from './components/TransitSections';
import { TransitSkeleton } from './components/TransitSkeleton';
import { useTransitTab } from './useTransitTab';

/**
 * QUIRK(ios): NativeTabs insets only the first ScrollView, resolved at mount, so the skeleton lives inside it.
 * SEE: docs/explanation/ios-26-native-tabs-minimize.md
 */
const NEEDS_MANUAL_TOP_INSET =
  !(Platform.OS === 'ios' && isLiquidGlassAvailable());

export function TransitTabScreen() {
  const styles = useStyles();
  const { t } = useT();
  const color = useSemanticColors();
  const insets = useSafeAreaInsets();
  const topInset = NEEDS_MANUAL_TOP_INSET ? insets.top : 0;
  const { data, isLoading, isError, groups, loadError, openRow, reviewHost } = useTransitTab({
    reviewIcon: <BusIcon size={32} color={color.fg.brandContrast} weight="fill" />,
  });

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: topInset }]}
        alwaysBounceVertical={false}
        overScrollMode="never"
      >
      {isLoading ? (
        <TransitSkeleton />
      ) : isError || !data ? (
        <ResultSection
          size="large"
          asset={<BusIcon size={SdsSpacing.x10} color={color.fg.neutralSubtle} />}
          title={t('transit.loadFailed')}
          primaryActionProps={{ children: t('common.retry'), onPress: loadError.onRetry }}
        />
      ) : (
        <>
          <TransitSections sections={data.sections} groups={groups} onOpenRow={openRow} />

          <View style={styles.bottomSpacer} />
        </>
      )}
    </ScrollView>
      {/* WHY: a later Fragment child, so the ScrollView stays the chain root. */}
      <View pointerEvents="none" style={[styles.statusBarBand, { height: insets.top }]} />
      <ReviewPromptHost {...reviewHost} />
    </>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
  content: {
    paddingBottom: SdsSpacing.x8,
  },
  statusBarBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: color.bg.layerDefault,
  },
  bottomSpacer: {
    height: 80,
  },
}));
