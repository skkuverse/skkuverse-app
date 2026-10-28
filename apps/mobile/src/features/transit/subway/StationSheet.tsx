import { View } from 'react-native';
import { TrainIcon } from 'phosphor-react-native';
import { SdsSpacing, useT } from '@skkuverse/shared';
import {
  Loader,
  ResultSection,
  Sheet,
  SheetCloseButton,
  Tab,
  Txt,
  createThemedStyles,
  useSemanticColors,
} from '@skkuverse/sds';
import type { MapSheetTrackingProps, MapSheetViewProps } from '@/features/map/sheet-views.types';
import { useViewTracking } from '@/platform/analytics';
import { Toggle } from './components/Toggle';
import { DirectionCard } from './DirectionCard';
import type { SubwayDirection } from './subway.types';
import { directionSide } from './track.rules';
import { useStationSheet } from './useStationSheet';

export function StationSheet({ tab, entry, sheet }: MapSheetViewProps<'subway_station'>) {
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
    onClose,
    bottomPadding,
  } = useStationSheet(tab, entry, sheet);

  const label = (d: SubwayDirection) => {
    if (d.nextStationName == null) return { text: d.name, spoken: d.name };
    const template = directionSide(d.direction) === 'left' ? 'subway.towardsLeft' : 'subway.towardsRight';
    return { text: tpl(template, d.nextStationName), spoken: tpl('subway.towards', d.nextStationName) };
  };

  return (
    <>
      <View style={styles.header}>
        <Txt typography="t7" fontWeight="bold" color="neutral" numberOfLines={1} style={styles.title}>
          {data ? tpl('subway.stationTitle', data.stationName) : ''}
        </Txt>
        <SheetCloseButton label={t('common.close')} onPress={onClose} />
      </View>
      <Sheet.ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: bottomPadding }}>
        {data && line && direction ? (
          <>
            <View style={styles.selector}>
              {lines.length > 1 ? (
                <Toggle
                  values={lines.map((l) => l.line.code)}
                  labels={lines.map((l) => l.line.name)}
                  selectedIndex={lineIndex}
                  onSelect={(code) => {
                    tracking.onTap('line');
                    onSelectLine(code);
                  }}
                />
              ) : null}
              {directions.length > 1 ? (
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
              ) : null}
            </View>
            <DirectionCard lineColor={line.line.color} direction={direction} side={directionSide(direction.direction)} now={now} />
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
      </Sheet.ScrollView>
    </>
  );
}

// WHY: the view itself sends `subway_open` and `subway_view`, so this logs only the sheet's open and close.
export function StationSheetTracking({ entry }: MapSheetTrackingProps<'subway_station'>) {
  useViewTracking('station_sheet', entry.request.stationId, entry.request.source);
  return null;
}

const useStyles = createThemedStyles(() => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x2,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: SdsSpacing.gutter,
    paddingBottom: SdsSpacing.x2,
  },
  title: {
    flex: 1,
  },
  scroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  selector: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingTop: SdsSpacing.x2,
    paddingBottom: SdsSpacing.x5,
    gap: SdsSpacing.x2,
  },
  state: {
    paddingVertical: SdsSpacing.x8,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
