import { View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import {
  hexToColor,
  useT,
  SdsRadius,
  SdsSpacing,
} from '@skkuverse/shared';
import { Badge, Border, Txt, createThemedStyles, useSemanticColors, useSurface } from '@skkuverse/sds';
import { PulseAnimation } from '../components/PulseAnimation';
import { trainTime } from './countdown.rules';
import { TRACK_TICKS, trackX, trainTrackPosition, trainsOnTrack, type TrackSide } from './track.rules';
import type { SubwayDirection, SubwayTrain } from './subway.types';

const DOT = 14;
const HALO = 26;
const STATION_RING = 20;
// WHY: a due train stops short of the station ring instead of sliding under it.
const MAX_TRACK = 0.9;
// WHY: a far train stops short of the far edge, where its halo would be clipped.
const MIN_TRACK = 0.04;
const SAME_SLOT_STEP = 0.06;
const TICK = 10;

interface DirectionCardProps {
  lineColor: string;
  direction: SubwayDirection;
  side: TrackSide;
  now: number;
}

export function DirectionCard({ lineColor: lineHex, direction, side, now }: DirectionCardProps) {
  const styles = useStyles();
  const semantic = useSemanticColors();
  const { t } = useT();
  const onGlass = useSurface() === 'glass';
  const lineColor = hexToColor(lineHex, semantic.bg.dataBrand);
  const [next, after] = direction.trains;
  const onTrack = trainsOnTrack(direction.trains);
  const clamp = (p: number) => Math.min(MAX_TRACK, Math.max(MIN_TRACK, p));
  const positions = onTrack.map((train) => clamp(trainTrackPosition(train, now)));
  if (positions.length === 2 && positions[1] > positions[0] - SAME_SLOT_STEP) {
    positions[1] = clamp(positions[0] - SAME_SLOT_STEP);
  }
  const at = (position: number) => `${trackX(position, side) * 100}%` as const;
  const [far, near] = side === 'left' ? ['100%', '0'] : ['0', '100%'];

  return (
    <View style={[styles.card, !onGlass && styles.cardFill]}>
      <View style={styles.top}>
        <View style={[styles.track, side === 'left' ? styles.trackLeft : styles.trackRight]}>
          <Svg style={styles.trackLine} height={2} width="100%">
            <Line
              x1={far}
              y1="1"
              x2={near}
              y2="1"
              stroke={semantic.stroke.neutralMuted}
              strokeWidth={2}
              strokeDasharray="5 5"
            />
          </Svg>
          {TRACK_TICKS.map((tick) => (
            <View key={tick} style={[styles.tick, { left: at(tick) }]} />
          ))}
          {positions.map((position, i) => {
            const train = onTrack[i];
            return (
              <View key={train.trainNo} style={[styles.marker, { left: at(position) }]}>
                {train === next ? <PulseAnimation color={lineColor + '66'} size={HALO} /> : null}
                <View style={[styles.dot, { backgroundColor: lineColor }]} />
              </View>
            );
          })}
          <View style={[styles.stationRing, { borderColor: lineColor, left: at(1) }]} />
        </View>
      </View>

      <Border variant="padding24" />

      <View style={styles.bottom}>
        {next ? (
          [next, after].map((train, i) =>
            train ? (
              <ArrivalRow
                key={train.trainNo}
                train={train}
                now={now}
                timeColor={i === 0 ? lineColor : undefined}
              />
            ) : null,
          )
        ) : (
          <Txt typography="t5" color="neutralSubtle" style={styles.empty}>
            {t('subway.noTrains')}
          </Txt>
        )}
      </View>
    </View>
  );
}

function ArrivalRow({ train, now, timeColor }: { train: SubwayTrain; now: number; timeColor?: string }) {
  const styles = useStyles();
  const { t, tpl } = useT();
  const { countdown: c, firstTrain } = trainTime(train, now);
  const time =
    c.kind === 'arriving'
      ? t('subway.arriving')
      : c.kind === 'at'
        ? tpl(firstTrain === 'label' ? 'subway.firstAt' : 'subway.at', c.time)
        : tpl('subway.min', c.minutes);
  return (
    <View style={styles.arrivalRow}>
      <View style={styles.destination}>
        <Txt typography="t7" fontWeight="medium" color="neutral" numberOfLines={1}>
          {tpl('subway.destination', train.headsign)}
        </Txt>
        {train.isExpress ? (
          <Badge size="small" color="critical" backgroundColor="criticalWeak">
            {t('subway.express')}
          </Badge>
        ) : null}
        {firstTrain === 'badge' ? (
          <Badge size="small" color="informative" backgroundColor="informativeWeak">
            {t('subway.firstTrain')}
          </Badge>
        ) : null}
      </View>
      <Txt
        typography="t7"
        fontWeight="bold"
        color="neutral"
        style={timeColor ? { color: timeColor } : undefined}
      >
        {time}
      </Txt>
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  card: {
    marginHorizontal: SdsSpacing.gutter,
    borderRadius: SdsRadius.r6,
    overflow: 'hidden',
  },
  cardFill: {
    backgroundColor: color.bg.neutralWeak,
  },
  top: {
    paddingHorizontal: SdsSpacing.x5,
    paddingVertical: SdsSpacing.x5,
  },
  track: {
    height: HALO,
  },
  // WHY: the station ring's half overhangs the station end.
  trackLeft: {
    marginLeft: STATION_RING / 2,
  },
  trackRight: {
    marginRight: STATION_RING / 2,
  },
  trackLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: HALO / 2 - 1,
  },
  tick: {
    position: 'absolute',
    bottom: (HALO - TICK) / 2,
    width: TICK,
    height: TICK,
    marginLeft: -TICK / 2,
    borderRadius: SdsRadius.full,
    borderWidth: 2,
    borderColor: color.stroke.neutralWeak,
    backgroundColor: color.bg.neutralWeak,
  },
  stationRing: {
    position: 'absolute',
    bottom: (HALO - STATION_RING) / 2,
    width: STATION_RING,
    height: STATION_RING,
    marginLeft: -STATION_RING / 2,
    borderRadius: SdsRadius.full,
    borderWidth: 4,
    backgroundColor: color.bg.layerDefault,
  },
  marker: {
    position: 'absolute',
    bottom: 0,
    width: HALO,
    height: HALO,
    marginLeft: -HALO / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: SdsRadius.full,
  },
  bottom: {
    paddingVertical: SdsSpacing.x4,
    paddingHorizontal: SdsSpacing.x5,
    gap: SdsSpacing.x3,
  },
  arrivalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SdsSpacing.x3,
  },
  destination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x1_5,
    flexShrink: 1,
  },
  empty: {
    textAlign: 'center',
  },
}));
