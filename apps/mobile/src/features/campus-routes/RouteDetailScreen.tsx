import { ScrollView, View } from 'react-native';
import { Stack } from 'expo-router';
import { MapTrifoldIcon } from 'phosphor-react-native';
import { SdsSpacing, useT } from '@skkuverse/shared';
import { ResultSection, Skeleton, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import { OptionCard } from './components/OptionCard';
import { useScrollRestore } from './components/useScrollRestore';
import { useRouteDetail } from './useRouteDetail';

export function RouteDetailScreen({ routeId, source }: { routeId: string | undefined; source: string | undefined }) {
  const styles = useStyles();
  const color = useSemanticColors();
  const { t } = useT();
  const vm = useRouteDetail(routeId, source);
  const asset = <MapTrifoldIcon size={SdsSpacing.x10} color={color.fg.neutralSubtle} />;
  const { scrollRef, onLayout, onContentSizeChange } = useScrollRestore(vm.initialScrollY, vm.status === 'ready', vm.settled);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      scrollEventThrottle={100}
      onScroll={(e) => vm.onScroll(e.nativeEvent.contentOffset.y)}
      onLayout={onLayout}
      onContentSizeChange={onContentSizeChange}
    >
      <Stack.Screen options={{ title: vm.status === 'ready' ? vm.title : '' }} />
      {vm.status === 'ready' ? (
        vm.options.map((option, i) => (
          // WHY: by position; an option id is the server's and is never read here.
          <OptionCard key={i} option={option} rides={vm.ridesOf(i)} onPlacePress={vm.onPlacePress} />
        ))
      ) : vm.status === 'notFound' ? (
        <ResultSection asset={asset} title={t('campusRoutes.notFound')} />
      ) : vm.status === 'error' ? (
        <ResultSection
          asset={asset}
          title={t('campusRoutes.loadFailed')}
          primaryActionProps={{ children: t('common.retry'), onPress: vm.onRetry }}
        />
      ) : (
        <Skeleton.Animate>
          <View style={styles.skeleton}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.skeletonBlock}>
                <Skeleton width={120} height={20} shape="text" />
                <Skeleton width={200} height={32} shape="text" />
                <Skeleton width="100%" shape="text" />
              </View>
            ))}
          </View>
        </Skeleton.Animate>
      )}
    </ScrollView>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
  content: {
    flexGrow: 1,
    paddingBottom: SdsSpacing.x10,
  },
  skeleton: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingTop: SdsSpacing.x4,
    gap: SdsSpacing.x8,
  },
  skeletonBlock: {
    gap: SdsSpacing.x2,
  },
}));
