import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import {
  useT,
  SdsSpacing,
} from '@skkuverse/shared';
import {
  ListRow,
  Txt,
  createThemedStyles,
} from '@skkuverse/sds';
import { TossfaceRuns } from '@/components/TossfaceRuns';
import { logBusContentSelect } from '@/platform/analytics';
import { getRouteBadge } from './schedule.rules';
import { STOP_DOT } from './schedule.constants';
import { BoardingPhotoViewer } from './BoardingPhotoViewer';
import { BoardingStopDetail } from './components/BoardingStopDetail';
import { toSubwayLinks, type SubwayLink } from './subway-links.rules';
import { TransitGlyph } from '../components/TransitGlyph';
import { routesForDay, toRouteRows } from './schedule-config.rules';
import type { BoardingStop, BusService, RouteBadge, ScheduleEntry, SequenceStop } from '../transit.types';
import type { OnStationPress } from './schedule.types';

const NAME_LINE = 22.5;
const DOT = 10;
const DOT_TOP = (NAME_LINE - DOT) / 2;
const RAIL = 22;
const RING_TOP = (NAME_LINE - STOP_DOT.size) / 2;
const RING_LEFT = (DOT - STOP_DOT.size) / 2;
const TRANSFER_GLYPH = 24;

interface BoardingSectionProps {
  service: BusService;
  stops: BoardingStop[];
  routeBadges: RouteBadge[];
  entries?: ScheduleEntry[];
  onStationPress: OnStationPress;
}

export function BoardingSection({ service, stops, routeBadges, entries, onStationPress }: BoardingSectionProps) {
  const styles = useStyles();
  const [photo, setPhoto] = useState<{ uri: string; label: string } | null>(null);
  const { routes, labelled } = routesForDay(service.stopSequences, routeBadges, entries);
  if (routes.length === 0) return null;
  const catalog = new Map(stops.map((s) => [s.id, s]));
  const subwayLinks = toSubwayLinks(
    routes.map((route) => route.sequence),
    catalog,
  );

  return (
    <View style={styles.container}>
      {subwayLinks.length > 0 ? <SubwayTransfer links={subwayLinks} onStationPress={onStationPress} /> : null}
      {routes.map((route) => (
        <DirectionRoute
          key={route.routeTypes.join('+')}
          label={
            labelled ? route.routeTypes.map((rt) => getRouteBadge(routeBadges, rt).label).join(' · ') : undefined
          }
          range={route.range}
          sequence={route.sequence}
          catalog={catalog}
          onOpenPhoto={(uri, label) => setPhoto({ uri, label })}
        />
      ))}
      <BoardingPhotoViewer uri={photo?.uri ?? null} label={photo?.label} onClose={() => setPhoto(null)} />
    </View>
  );
}

function DirectionRoute({
  label,
  range,
  sequence,
  catalog,
  onOpenPhoto,
}: {
  label?: string;
  range: string | null;
  sequence: SequenceStop[];
  catalog: ReadonlyMap<string, BoardingStop>;
  onOpenPhoto: (uri: string, label: string) => void;
}) {
  const styles = useStyles();
  const { t } = useT();
  const rows = toRouteRows(sequence, catalog, (action) =>
    t(action === 'board' ? 'schedule.boarding.board' : 'schedule.boarding.alight'),
  );

  return (
    <View>
      {label || range ? (
        <View style={styles.header}>
          {label ? (
            <Txt typography="t7" fontWeight="bold" color="neutral">
              <TossfaceRuns text={label} />
            </Txt>
          ) : null}
          {range ? (
            <Txt typography="t5" fontWeight="semiBold" color="neutralSubtle" style={styles.tabular}>
              {range}
            </Txt>
          ) : null}
        </View>
      ) : null}

      {rows.map((row, j) => (
        <RouteRow
          key={row.key}
          first={j === 0}
          last={j === rows.length - 1}
          alight={row.action === 'alight'}
          name={row.name}
          role={row.role}
        >
          {row.detail ? (
            <Txt typography="t4" color="neutralSubtle" style={styles.seqDetail}>
              <TossfaceRuns text={row.detail} />
            </Txt>
          ) : null}
          {row.stop ? <BoardingStopDetail stop={row.stop} onOpenPhoto={onOpenPhoto} /> : null}
        </RouteRow>
      ))}
    </View>
  );
}

/** WHY: the rail is drawn per row so it runs unbroken through rows of any height without measuring them. */
function RouteRow({
  first,
  last,
  alight,
  name,
  role,
  children,
}: {
  first: boolean;
  last: boolean;
  alight: boolean;
  name: string;
  role?: string;
  children?: ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        {first ? null : <View style={[styles.line, styles.lineAbove]} />}
        {last ? null : <View style={[styles.line, styles.lineBelow]} />}
        <View style={alight ? styles.ring : styles.dot} />
      </View>
      <View style={[styles.body, !last && (children ? styles.bodyGapLarge : styles.bodyGap)]}>
        <View style={styles.nameRow}>
          <Txt typography="t5" fontWeight="semiBold" color="neutral" style={styles.name}>
            <TossfaceRuns text={name} />
          </Txt>
          {role ? (
            <Txt typography="t1" fontWeight="medium" color="neutralSubtle">
              {role}
            </Txt>
          ) : null}
        </View>
        {children}
      </View>
    </View>
  );
}

function SubwayTransfer({ links, onStationPress }: { links: readonly SubwayLink[]; onStationPress: OnStationPress }) {
  const styles = useStyles();
  const { t, tpl } = useT();
  return (
    <View>
      <View style={styles.header}>
        <Txt typography="t7" fontWeight="bold" color="neutral" accessibilityRole="header">
          {t('schedule.transfer.title')}
        </Txt>
      </View>
      {links.map((link) => (
        <ListRow
          key={link.stationId}
          horizontalPadding={0}
          verticalPadding="xsmall"
          withArrow
          accessibilityRole="button"
          accessibilityLabel={tpl('schedule.liveTrains', link.title)}
          left={<TransitGlyph iconType="subway" size={TRANSFER_GLYPH} />}
          contents={
            <ListRow.Texts
              layout="2RowTypeA"
              top={link.title}
              topProps={{ typography: 't5', fontWeight: 'semiBold' }}
              bottom={t('schedule.transfer.liveTrains')}
              bottomProps={{ typography: 't3' }}
            />
          }
          onPress={() => {
            logBusContentSelect({ content_type: 'boarding_subway', item_id: link.stationId });
            onStationPress(link.stationId, 'schedule_boarding');
          }}
        />
      ))}
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    paddingHorizontal: SdsSpacing.gutter,
    gap: SdsSpacing.x8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SdsSpacing.x2,
    marginBottom: SdsSpacing.x3,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  row: {
    flexDirection: 'row',
  },
  rail: {
    width: RAIL,
  },
  line: {
    position: 'absolute',
    left: DOT / 2 - 1,
    width: 2,
    backgroundColor: color.bg.neutralWeak,
  },
  lineAbove: {
    top: 0,
    height: DOT_TOP + DOT / 2,
  },
  lineBelow: {
    top: DOT_TOP + DOT / 2,
    bottom: 0,
  },
  dot: {
    marginTop: DOT_TOP,
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: color.stroke.control,
  },
  ring: {
    marginTop: RING_TOP,
    marginLeft: RING_LEFT,
    width: STOP_DOT.size,
    height: STOP_DOT.size,
    borderRadius: STOP_DOT.size / 2,
    borderWidth: STOP_DOT.border,
    borderColor: color.stroke.neutralWeak,
    backgroundColor: color.bg.layerDefault,
  },
  body: {
    flex: 1,
  },
  bodyGap: {
    paddingBottom: SdsSpacing.x3_5,
  },
  bodyGapLarge: {
    paddingBottom: SdsSpacing.x6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x2,
  },
  name: {
    flexShrink: 1,
  },
  seqDetail: {
    marginTop: SdsSpacing.x0_5,
  },
}));
