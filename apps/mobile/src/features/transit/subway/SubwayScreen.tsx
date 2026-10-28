import { ScrollView, View } from 'react-native';
import { Stack } from 'expo-router';
import { TrainIcon } from 'phosphor-react-native';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { Loader, ResultSection, Tab, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import { AdaptiveBanner } from '@/features/ads/AdaptiveBanner';
import { AdUnitIds } from '@/platform/ads';
import { DirectionCard } from './DirectionCard';
import { Toggle } from './components/Toggle';
import { useSubway } from './useSubway';
import { directionSide } from './track.rules';
import type { SubwayDirection } from './subway.types';

export function SubwayScreen({
  station,
  lineParam,
  source,
}: {
  station: string;
  lineParam?: string;
  source?: string;
}) {
  const styles = useStyles();
  const color = useSemanticColors();
  const { t, tpl } = useT();
  const {
    data,
    isLoading,
    isError,
    now,
    lines,
    line,
    lineIndex,
    directions,
    direction,
    tracking,
    onSelectLine,
    onSelectDirection,
  } = useSubway(station, lineParam, source);
  // WHY: named by the station a train leaves for next, as a station sign does; the line's own names are termini.
  // The server sends `up` then `down`, so the left tab points left.
  const label = (d: SubwayDirection) => {
    if (d.nextStationName == null) return { text: d.name, spoken: d.name };
    const template = directionSide(d.direction) === 'left' ? 'subway.towardsLeft' : 'subway.towardsRight';
    return {
      text: tpl(template, d.nextStationName),
      spoken: tpl('subway.towards', d.nextStationName),
    };
  };
  const lineSelector =
    lines.length > 1 ? (
      <Toggle
        values={lines.map((l) => l.line.code)}
        labels={lines.map((l) => l.line.name)}
        selectedIndex={lineIndex}
        onSelect={(code) => {
          tracking.onTap('line');
          onSelectLine(code);
        }}
      />
    ) : null;
  const directionSelector =
    line && directions.length > 1 && direction ? (
      <Tab
        value={direction.direction}
        onChange={(value) => {
          const next = directions.find((d) => d.direction === value);
          if (!next) return;
          tracking.onTap('direction');
          onSelectDirection(line.line.code, next.direction);
        }}
        size="small"
      >
        {directions.map((d) => {
          const { text, spoken } = label(d);
          return (
            <Tab.Item key={d.direction} value={d.direction} accessibilityLabel={spoken}>
              {text}
            </Tab.Item>
          );
        })}
      </Tab>
    ) : null;

  // WHY: the banner sits under the scroller so every state keeps it pinned at the bottom, as on the bus screens.
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: data ? tpl('subway.stationTitle', data.stationName) : '' }} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {data && line && direction ? (
          <>
            <View style={styles.selector}>
              {lineSelector}
              {directionSelector}
            </View>
            <DirectionCard
              lineColor={line.line.color}
              direction={direction}
              side={directionSide(direction.direction)}
              now={now}
            />
          </>
        ) : data && lines.length === 0 ? (
          // WHY: a station served with no line, as Sungkyunkwan University is briefly while the server deploys.
          <ResultSection
            asset={<TrainIcon size={SdsSpacing.x10} color={color.fg.neutralSubtle} />}
            title={t('subway.noTrains')}
          />
        ) : isLoading ? (
          <View style={styles.state}>
            <Loader size="medium" delay={700} />
          </View>
        ) : isError ? (
          <ResultSection
            asset={<TrainIcon size={SdsSpacing.x10} color={color.fg.neutralSubtle} />}
            title={t('subway.loadFailed')}
            primaryActionProps={{ children: t('common.retry'), onPress: tracking.onRetry }}
          />
        ) : null}
      </ScrollView>

      <AdaptiveBanner unitId={AdUnitIds.subwayBanner} />
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: SdsSpacing.x10,
  },
  selector: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingTop: SdsSpacing.x2,
    paddingBottom: SdsSpacing.x5,
    gap: SdsSpacing.x2,
  },
  state: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
