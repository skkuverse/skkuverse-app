import { Fragment } from 'react';
import { View, StyleSheet } from 'react-native';
import { type FgColorName, asSdsColor, hexToColor, useT, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { Txt, Badge, useSemanticColors } from '@skkuverse/sds';
import { toLineAttachments, type PlacedAttachments } from './run-attachments.rules';
import { RunAttachments } from './RunAttachments';
import { EstimateMark } from './components/EstimateMark';
import { TossfaceRuns } from '@/components/TossfaceRuns';
import { decideStopDotTone, getRouteBadge, isPastTime, type StopDotTone } from './schedule.rules';
import { SHOW_CROWDING, STOP_DOT, TIMETABLE_COLUMNS } from './schedule.constants';
import type { OnStationPress, TimetableLayout } from './schedule.types';
import type { RunStop } from './schedule-config.rules';
import type { ScheduleEntry, RouteBadge } from '../transit.types';

const ROW_PAD = 13;
const STOP_PAD = 5;

interface ScheduleRowProps {
  entry: ScheduleEntry;
  isPast: boolean;
  isNext: boolean;
  isToday: boolean;
  now: number;
  routeBadges: RouteBadge[];
  showBadge: boolean;
  stops?: RunStop[] | null;
  layout?: TimetableLayout;
  attachments?: readonly PlacedAttachments[];
  runKey?: string;
  onStationPress: OnStationPress;
}

export function ScheduleRow({
  entry,
  isPast,
  isNext,
  isToday,
  now,
  routeBadges,
  showBadge,
  stops,
  layout = 'v1',
  attachments,
  runKey = '',
  onStationPress,
}: ScheduleRowProps) {
  const color = useSemanticColors();
  const { t, tpl } = useT();
  const badge = getRouteBadge(routeBadges, entry.routeType);
  const sectioned = layout === 'sectioned';
  const background = isNext ? color.bg.brandWeak : color.bg.layerDefault;
  const nextText = isNext && !sectioned;

  const dotColors: Record<StopDotTone, string> = {
    otherDay: color.fg.disabled,
    past: color.bg.neutralWeak,
    next: color.bg.brandSolid,
    upcoming: color.stroke.control,
  };
  const dotColorFor = (past: boolean, hollow: boolean) =>
    dotColors[decideStopDotTone({ layout, isToday, isNext, past, hollow })];
  const multi = !!stops && stops.length > 1;
  const firstHollow = stops?.[0].stop.action === 'alight';
  const routeColor = hexToColor(badge.color, color.bg.dataBrand);
  const busUnit = tpl('schedule.busUnit', entry.busCount);
  const lineAttachments = toLineAttachments(attachments ?? [], stops ?? null);
  const attachmentsUnder = (stopIndex: number, last: boolean) =>
    lineAttachments[stopIndex].map((group, g, all) => (
      <RunAttachments
        key={group.anchor.level === 'run' ? 'run' : group.anchor.stopId}
        group={group}
        runKey={runKey}
        rail={!last}
        last={last && g === all.length - 1}
        onStationPress={onStationPress}
      />
    ));
  const firstAttached = lineAttachments[0].length > 0;

  return (
    <View style={isNext && { backgroundColor: color.bg.brandWeak }}>
      <View style={[styles.container, (multi || firstAttached) && styles.containerTopOfRun]}>
        <DotCell
          color={dotColorFor(isPast, firstHollow)}
          hollow={firstHollow}
          background={background}
          below={multi}
          padBelow={STOP_PAD}
        />

        <Txt
          typography="t6"
          fontWeight={nextText ? 'bold' : 'medium'}
          color={isPast ? 'disabled' : nextText ? 'brand' : 'neutral'}
          style={sectioned ? styles.gridTime : styles.time}
        >
          {entry.time}
        </Txt>

        {sectioned ? null : (
          <View style={styles.nextBadgeSlot}>
            {isNext && (
              <Badge size="small" color="brand" backgroundColor="brandWeak" style={{ borderRadius: SdsRadius.r5 }}>
                {t('transit.next')}
              </Badge>
            )}
          </View>
        )}

        {showBadge && (
          <View style={sectioned ? styles.gridRoute : styles.routeBadgeSlot}>
            <Badge
              size="xsmall"
              color={isPast ? 'disabled' : sectioned ? 'neutralMuted' : asSdsColor(routeColor)}
              backgroundColor={sectioned ? 'neutralWeak' : isPast ? 'neutralMuted' : asSdsColor(routeColor + '1F')}
              fontWeight={sectioned ? 'regular' : undefined}
              numberOfLines={1}
              style={badgeStretchStyle}
            >
              <TossfaceRuns text={badge.label} />
            </Badge>
          </View>
        )}

        {sectioned ? (
          <Txt
            typography="t3"
            color={isPast ? 'disabled' : 'neutralMuted'}
            textAlign="center"
            numberOfLines={1}
            style={styles.gridCount}
          >
            {busUnit}
          </Txt>
        ) : (
          <Txt typography="t3" fontWeight="semiBold" color={isPast ? 'disabled' : 'neutral'}>
            {busUnit}
          </Txt>
        )}

        <Notes
          text={stops ? stops[0].note : entry.notes}
          past={isPast}
          extraMargin={!showBadge}
          sectioned={sectioned}
        />

        {SHOW_CROWDING && <CrowdingCell crowding={entry.crowding} past={isPast} />}
      </View>
      {attachmentsUnder(0, !multi)}

      {stops?.slice(1).map(({ stop, time, note }, k) => {
        const last = k === stops.length - 2;
        const attached = lineAttachments[k + 1].length > 0;
        const past = isPast || (time !== null && isPastTime(time, isToday, now));
        const hollow = stop.action === 'alight';
        // WHY: an `estimated` stop may hold the timetable's own time; only a traffic estimate carries `eta`.
        const estimated = !!entry.eta && stop.timing === 'estimated' && time !== null;
        const timeColor = past ? 'disabled' : 'neutral';
        return (
          <Fragment key={k}>
            <View style={[styles.stopLine, last && !attached && styles.stopLineLast]}>
              <DotCell
                color={dotColorFor(past, hollow)}
                hollow={hollow}
                background={background}
                above
                padAbove={STOP_PAD}
                below={!last}
                padBelow={STOP_PAD}
              />
              {estimated ? (
                // WHY: a stop line leaves the route and count cells empty, so the star may overflow into them.
                <View
                  style={[sectioned ? styles.gridTimeCell : styles.time, styles.estimatedTime]}
                  accessible
                  accessibilityLabel={`${time} ${t('schedule.eta.estimated')}`}
                >
                  <Txt typography="t6" fontWeight="medium" color={timeColor} style={sectioned && styles.tabular}>
                    {time}
                  </Txt>
                  <EstimateMark past={past} live={entry.eta?.source === 'live'} />
                </View>
              ) : (
                <Txt
                  typography="t6"
                  fontWeight="medium"
                  color={timeColor}
                  style={sectioned ? styles.gridTime : styles.time}
                >
                  {time ?? '–'}
                </Txt>
              )}
              {sectioned ? null : <View style={styles.nextBadgeSlot} />}
              {showBadge && <View style={sectioned ? styles.gridRoute : styles.routeBadgeSlot} />}
              {sectioned ? (
                <View style={styles.gridCount} />
              ) : (
                // WHY: the invisible bus count holds a stop line's column at its run's own width.
                <Txt
                  typography="t3"
                  fontWeight="semiBold"
                  style={styles.hidden}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  {busUnit}
                </Txt>
              )}
              <Notes text={note} past={past} extraMargin={!showBadge} sectioned={sectioned} />
              {SHOW_CROWDING && <View style={styles.crowding} />}
            </View>
            {attachmentsUnder(k + 1, last)}
          </Fragment>
        );
      })}
    </View>
  );
}

function Notes({
  text,
  past,
  extraMargin,
  sectioned,
}: {
  text: string | null | undefined;
  past: boolean;
  extraMargin: boolean;
  sectioned: boolean;
}) {
  // QUIRK(skkuverse-server): a note carries a literal backslash-n for a line break.
  const notes = text?.replace(/\\n/g, '\n');
  if (sectioned) {
    return (
      <Txt
        typography="t3"
        color={past ? 'disabled' : 'neutralMuted'}
        numberOfLines={2}
        style={[styles.notes, styles.gridNotes]}
      >
        {notes ? <TossfaceRuns text={notes} /> : '—'}
      </Txt>
    );
  }
  return (
    <Txt
      typography="t2"
      color={past || !notes ? 'disabled' : 'warningContrast'}
      fontWeight={notes ? 'semiBold' : 'regular'}
      numberOfLines={2}
      style={[styles.notes, extraMargin && styles.notesExtraMargin]}
    >
      {notes ? <TossfaceRuns text={notes} /> : '—'}
    </Txt>
  );
}

const CROWDING_COLOR: Record<ScheduleEntry['crowding'], FgColorName> = {
  unknown: 'placeholder',
  spacious: 'positiveContrast',
  crowded: 'warningContrast',
  full: 'criticalContrast',
};

function CrowdingCell({ crowding, past }: { crowding: ScheduleEntry['crowding']; past: boolean }) {
  const { t } = useT();
  const known = crowding !== 'unknown';
  return (
    <Txt
      typography="t1"
      fontWeight={known ? 'semiBold' : 'regular'}
      color={past ? 'disabled' : CROWDING_COLOR[crowding]}
      textAlign="center"
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.8}
      style={styles.crowding}
    >
      {t(`transit.crowding.${crowding}`)}
    </Txt>
  );
}

/** WHY: the rail is drawn per line so it runs unbroken through lines of any height. */
function DotCell({
  color,
  hollow,
  background,
  above = false,
  below = false,
  padAbove = 0,
  padBelow = 0,
}: {
  color: string;
  hollow: boolean;
  background: string;
  above?: boolean;
  below?: boolean;
  padAbove?: number;
  padBelow?: number;
}) {
  const rail = useSemanticColors().bg.neutralWeak;
  return (
    <View style={styles.dotColumn}>
      {above ? <View style={[styles.rail, { top: -padAbove, bottom: '50%', backgroundColor: rail }]} /> : null}
      {below ? <View style={[styles.rail, { top: '50%', bottom: -padBelow, backgroundColor: rail }]} /> : null}
      <View
        style={[
          styles.dot,
          hollow
            ? {
                borderWidth: STOP_DOT.border,
                borderColor: color,
                backgroundColor: background,
              }
            : { backgroundColor: color },
        ]}
      />
    </View>
  );
}

const badgeStretchStyle = { alignSelf: 'stretch' as const };

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SdsSpacing.gutter,
    paddingVertical: ROW_PAD,
    gap: SdsSpacing.x2_5,
  },
  containerTopOfRun: {
    paddingBottom: STOP_PAD,
  },
  dotColumn: {
    width: 16,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rail: {
    position: 'absolute',
    left: 7,
    width: 2,
  },
  dot: {
    width: STOP_DOT.size,
    height: STOP_DOT.size,
    borderRadius: STOP_DOT.size / 2,
  },
  time: {
    minWidth: 44,
  },
  gridTime: {
    width: TIMETABLE_COLUMNS.time,
    fontVariant: ['tabular-nums'],
  },
  gridTimeCell: {
    width: TIMETABLE_COLUMNS.time,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  estimatedTime: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SdsSpacing.x0_5,
  },
  nextBadgeSlot: {
    width: 42,
    alignItems: 'center',
  },
  routeBadgeSlot: {
    width: 56,
    alignItems: 'center',
  },
  gridRoute: {
    width: TIMETABLE_COLUMNS.route,
    alignItems: 'center',
  },
  gridCount: {
    width: TIMETABLE_COLUMNS.count,
  },
  gridNotes: {
    marginLeft: TIMETABLE_COLUMNS.notesInset,
  },
  notes: {
    flex: 1,
  },
  crowding: {
    width: TIMETABLE_COLUMNS.crowding,
  },
  notesExtraMargin: {
    marginLeft: SdsSpacing.x3_5,
  },
  stopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SdsSpacing.gutter,
    paddingVertical: STOP_PAD,
    gap: SdsSpacing.x2_5,
  },
  stopLineLast: {
    paddingBottom: ROW_PAD,
  },
  hidden: {
    opacity: 0,
  },
});
