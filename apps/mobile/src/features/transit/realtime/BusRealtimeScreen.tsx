import { View, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { InfoIcon } from 'phosphor-react-native';
import { hexToColor, SdsSpacing } from '@skkuverse/shared';
import { useSemanticColors, createThemedStyles } from '@skkuverse/sds';
import { AdaptiveBanner } from '@/features/ads/AdaptiveBanner';
import { AdUnitIds } from '@/platform/ads';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { RefreshFab } from '../components/RefreshFab';
import { TopInfoBar } from './TopInfoBar';
import { StationRow } from './StationRow';
import { BusMarker } from './BusMarker';
import { RealtimeSkeleton } from './RealtimeSkeleton';
import { useBusRealtime } from './useBusRealtime';
import { STATION_ROW_HEIGHT } from './marker-geometry.rules';

export function BusRealtimeScreen({ groupId, source }: { groupId: string; source?: string }) {
  const styles = useStyles();
  const color = useSemanticColors();
  const {
    config,
    configLoading,
    screenConfig,
    vehicles,
    noInfo,
    dataUpdatedAt,
    resumedAtMs,
    awaitingFreshPoll,
    nowMs,
    refetch,
    arrivals,
    clockOffsetMs,
    infoUrl,
    handleInfoPress,
  } = useBusRealtime(groupId, source);

  const themeColor = hexToColor(config?.card.themeColor, color.bg.dataBrand);

  if (configLoading || !config) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: '' }} />
        <RealtimeSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: config.label,
          headerRight: infoUrl
            ? () => (
                <HeaderIconButton onPress={handleInfoPress}>
                  <InfoIcon size={22} color={color.fg.neutral} />
                </HeaderIconButton>
              )
            : undefined,
        }}
      />

      <TopInfoBar
        totalBuses={vehicles.length}
        noInfo={noInfo}
        serviceOver={arrivals.serviceOver}
      />

      <View style={styles.divider} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View>
          {screenConfig?.stations.map((station) => (
            <StationRow
              key={station.index}
              station={station}
              themeColor={config.card.themeColor}
              arrival={arrivals.lines.get(station.index)}
            />
          ))}

          {screenConfig?.isLoop && <View style={styles.loopReturn} />}

          {/* WHY: keyed by vehicle id so a marker stays mounted and glides from stop to stop. */}
          {screenConfig &&
            vehicles.map((vehicle) => (
              <BusMarker
                key={vehicle.id}
                vehicle={vehicle}
                line={screenConfig}
                hasPlates={screenConfig.hasPlates}
                isLowFloor={arrivals.lowFloorIds.has(vehicle.id)}
                color={themeColor}
                refreshIntervalSec={screenConfig.refreshInterval}
                clockOffsetMs={clockOffsetMs}
                pollAtMs={dataUpdatedAt}
                resumedAtMs={resumedAtMs}
                holding={awaitingFreshPoll}
                nowMs={nowMs}
              />
            ))}
        </View>
      </ScrollView>

      <RefreshFab
        color={themeColor}
        onPress={() => refetch()}
        analytics={{ content_type: 'realtime_refresh', item_id: 'fab' }}
      />

      <AdaptiveBanner unitId={AdUnitIds.busBanner} />
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
  divider: {
    height: 0.5,
    backgroundColor: color.stroke.neutralWeak,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SdsSpacing.x4,
  },
  loopReturn: {
    height: STATION_ROW_HEIGHT,
  },
}));
