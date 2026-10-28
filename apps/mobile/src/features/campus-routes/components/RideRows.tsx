import { View } from 'react-native';
import { CaretDownIcon, CaretUpIcon } from 'phosphor-react-native';
import { SdsRadius, SdsSpacing, useT } from '@skkuverse/shared';
import { Badge, Pressable, Tossface, Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import type { RideTimingView, RideView } from '../campus-routes.types';
import { MARK, PlaceLine, RailRow, useLineColor, type OnPlacePress, type RailLine } from './RailRow';

// WHY: expansion lives on the page, so a page pushed back by a place's close keeps its rides open.
export function RideRows({
  ride,
  above,
  below,
  expanded,
  onToggle,
  onPlacePress,
}: {
  ride: RideView;
  above: RailLine;
  below: RailLine;
  expanded: boolean;
  onToggle: () => void;
  onPlacePress: OnPlacePress;
}) {
  const styles = useStyles();
  const color = useSemanticColors();
  const fill = useLineColor(ride.color);
  const line: RailLine = { kind: 'solid', color: fill };
  const canExpand = ride.stops.length > 0;
  const Caret = expanded ? CaretUpIcon : CaretDownIcon;

  return (
    <>
      <RailRow
        mark={
          <View style={[styles.boardMark, fill ? { borderColor: fill } : null]}>
            <Tossface size={16}>{ride.emoji}</Tossface>
          </View>
        }
        above={above}
        below={line}
      >
        <View style={styles.inline}>
          <PlaceLine place={ride.board} onPlacePress={onPlacePress} />
          <Txt
            typography="t3"
            fontWeight="bold"
            numberOfLines={1}
            color={fill ? undefined : 'neutralSubtle'}
            style={fill ? { color: fill } : null}
          >
            {ride.label}
          </Txt>
        </View>
        <RideTiming timing={ride.timing} />
        {canExpand ? (
          <Pressable
            bg="layerDefault"
            scaleScope="content"
            contentStyle={styles.inline}
            onPress={onToggle}
          >
            <Txt typography="t3" color="neutralSubtle">
              {ride.stopsSummary}
            </Txt>
            <Caret size={SdsSpacing.x3} color={color.fg.neutralSubtle} />
          </Pressable>
        ) : ride.stopsSummary ? (
          <Txt typography="t3" color="neutralSubtle">
            {ride.stopsSummary}
          </Txt>
        ) : null}
      </RailRow>
      {expanded
        ? ride.stops.map((stop, i) => (
            <RailRow
              key={i}
              mark={<View style={[styles.stopDot, fill ? { borderColor: fill } : null]} />}
              above={line}
              below={line}
            >
              <PlaceLine place={stop} weight="regular" onPlacePress={onPlacePress} />
            </RailRow>
          ))
        : null}
      <RailRow
        mark={<View style={[styles.alightMark, fill ? { backgroundColor: fill } : null]} />}
        above={line}
        below={below}
      >
        <PlaceLine place={ride.alight} word="campusRoutes.alight" onPlacePress={onPlacePress} />
      </RailRow>
    </>
  );
}

function RideTiming({ timing }: { timing: RideTimingView }) {
  const styles = useStyles();
  const runs = timing.kind === 'upcoming' ? timing.runs : [timing.board];
  return (
    <View style={styles.inline}>
      {runs.map((run, i) => (
        <View key={i} style={styles.inline}>
          {i > 0 ? (
            <Txt typography="t4" color="neutralSubtle">
              ·
            </Txt>
          ) : null}
          <Txt
            typography="t4"
            fontWeight={i === 0 ? 'bold' : 'regular'}
            color={i > 0 ? 'neutralSubtle' : timing.kind === 'upcoming' ? 'brand' : 'neutral'}
          >
            {run.text}
          </Txt>
          {run.isLastRun ? <LastRunBadge /> : null}
        </View>
      ))}
    </View>
  );
}

// WHY: critical emphasis, since it is the end-of-service signal.
function LastRunBadge() {
  const { t } = useT();
  return (
    <Badge size="xsmall" color="criticalContrast" backgroundColor="criticalWeak">
      {t('campusRoutes.lastRun')}
    </Badge>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  boardMark: {
    width: MARK,
    height: MARK,
    borderRadius: SdsRadius.full,
    borderWidth: 2,
    borderColor: color.stroke.neutralWeak,
    backgroundColor: color.bg.layerDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alightMark: {
    width: SdsSpacing.x4,
    height: SdsSpacing.x4,
    borderRadius: SdsRadius.full,
    backgroundColor: color.bg.neutralSolid,
  },
  stopDot: {
    width: SdsSpacing.x2,
    height: SdsSpacing.x2,
    borderRadius: SdsRadius.full,
    borderWidth: 2,
    borderColor: color.stroke.neutralWeak,
    backgroundColor: color.bg.layerDefault,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SdsSpacing.x1,
  },
}));
