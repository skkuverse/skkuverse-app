import { View } from 'react-native';
import { CaretRightIcon } from 'phosphor-react-native';
import { SdsPalette, useT, hexToColor, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { STATION_ROW_HEIGHT, LEFT_PADDING, PLATE_GUTTER } from './marker-geometry.rules';
import { formatArrivalText, stationLine, type ArrivalLine } from '../arrival.rules';
import { createThemedStyles, useSemanticColors, useSurface, Pressable, Txt, Badge, LIST_ROW_ARROW } from '@skkuverse/sds';
import type { RealtimeStation } from '../transit.types';

const LINE_WIDTH = 3;
const DOT_SIZE = 12;

interface StationRowProps {
  station: RealtimeStation;
  themeColor: string;
  arrival?: ArrivalLine;
  onPress?: () => void;
  /** WHY: the badge comes from the flags, never the name; a pass-through then shows no arrival line. */
  showsStopDetails?: boolean;
}

export function StationRow({ station, themeColor, arrival: served, onPress, showsStopDetails = false }: StationRowProps) {
  const semantic = useSemanticColors();
  // WHY: on a glass sheet a layer fill is an opaque block (COLOR-12), and the line stops either
  // side of the dot, so it can let the sheet show through.
  const plate = useSurface() === 'glass' ? semantic.bg.transparent : semantic.bg.layerDefault;
  const styles = useStyles();
  const translate = useT();
  const { t } = translate;
  const color = hexToColor(themeColor, semantic.bg.dataBrand);
  // WHY: with the stop details a pass-through says so in its badge, so its
  // detail row would only repeat it; the realtime screen keeps the text.
  const arrival = showsStopDetails && station.isPassThrough ? undefined : stationLine(station, served);
  const arrivalText = arrival ? formatArrivalText(arrival.text, translate) : undefined;

  const body = (
    <>
      <View style={styles.timelineContainer}>
        <View
          style={[
            styles.line,
            !station.isFirstStation && { backgroundColor: color },
          ]}
        />

        {station.isRotationStation ? (
          <View style={[styles.rotationBadge, { borderColor: color, backgroundColor: plate }]}>
            <Txt typography="t1" fontWeight="bold" style={{ color }}>
              {t('transit.turn')}
            </Txt>
          </View>
        ) : (
          <View style={[styles.dot, { borderColor: color, backgroundColor: plate }]}>
            <View style={[styles.dotInner, { backgroundColor: color }]} />
          </View>
        )}

        <View
          style={[
            styles.line,
            !station.isLastStation && { backgroundColor: color },
          ]}
        />
      </View>

      <View style={styles.infoContainer}>
        <View style={styles.nameRow}>
          <Txt typography="t5" fontWeight="bold" style={styles.stationName} numberOfLines={1}>
            {station.name}
          </Txt>
          {showsStopDetails && station.isPassThrough && (
            <Badge size="xsmall" color="warning" backgroundColor="warningWeak">
              {t('realtime.arrival.passThrough')}
            </Badge>
          )}
          {showsStopDetails && station.isAlightOnly && (
            <Badge size="xsmall" color="warning" backgroundColor="warningWeak">
              {t('transit.stop.alightOnly')}
            </Badge>
          )}
          {showsStopDetails && station.stationNumber && (
            <Txt typography="t1" color="neutralSubtle">
              {station.stationNumber}
            </Txt>
          )}
          {station.transferLines.map((tl) => (
            <View
              key={tl.line}
              style={[
                styles.transferDot,
                { backgroundColor: hexToColor(tl.color, semantic.bg.dataBrand) },
              ]}
            >
              {/* WHY: the line color is data, so the text on it is static white in both schemes. */}
              <Txt typography="t1" fontWeight="bold" style={{ color: SdsPalette.static.white }}>
                {tl.line}
              </Txt>
            </View>
          ))}
        </View>

        {(station.subtitle || arrival) && (
          <View style={styles.detailRow}>
            {station.subtitle && (
              <Txt typography="t1" style={styles.detailText} numberOfLines={1}>
                {arrival ? `${station.subtitle} |` : station.subtitle}
              </Txt>
            )}
            {arrival?.isLastRun && (
              <Badge size="xsmall" color="critical" backgroundColor="criticalWeak">
                {t('realtime.lastBus')}
              </Badge>
            )}
            {arrivalText && (
              <Txt typography="t1" style={[styles.detailText, styles.arrivalText]} numberOfLines={1}>
                {arrivalText}
              </Txt>
            )}
          </View>
        )}
      </View>

      {onPress ? (
        <CaretRightIcon size={LIST_ROW_ARROW.size} color={semantic.fg[LIST_ROW_ARROW.color]} style={styles.chevron} />
      ) : null}
    </>
  );

  if (!onPress) return <View style={styles.container}>{body}</View>;
  return (
    <Pressable bg="layerFloating" onPress={onPress} accessibilityRole="button" style={styles.container}>
      {body}
    </Pressable>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    height: STATION_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: PLATE_GUTTER,
    paddingRight: SdsSpacing.gutter,
  },
  timelineContainer: {
    width: LEFT_PADDING,
    height: STATION_ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    width: LINE_WIDTH,
    flex: 1,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotInner: {
    width: 4,
    height: 4,
    borderRadius: SdsRadius.full,
  },
  rotationBadge: {
    borderWidth: 1.5,
    borderRadius: SdsRadius.r2,
    paddingHorizontal: SdsSpacing.x1_5,
    paddingVertical: SdsSpacing.x0_5,
  },
  infoContainer: {
    flex: 1,
    gap: SdsSpacing.x0_5,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x1_5,
  },
  stationName: {
    flexShrink: 1,
    color: color.fg.neutral,
  },
  chevron: {
    marginLeft: SdsSpacing.x2,
  },
  transferDot: {
    width: 20,
    height: 20,
    borderRadius: SdsRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x1,
  },
  detailText: {
    color: color.fg.neutralSubtle,
  },
  arrivalText: {
    flexShrink: 1,
  },
}));
