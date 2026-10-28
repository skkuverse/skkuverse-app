import { View } from 'react-native';
import { SdsSpacing, useT } from '@skkuverse/shared';
import { Badge, Txt, createThemedStyles } from '@skkuverse/sds';
import { kstClockOf, type StopSheetRow } from '../stop.rules';
import { formatArrivalText } from '../../arrival.rules';

export function StopRouteRow({ row }: { row: StopSheetRow }) {
  const styles = useStyles();
  const translate = useT();
  const { t, tpl } = translate;

  const heading =
    row.kind === 'live'
      ? [row.direction, row.towards === null ? t('transit.stop.terminal') : tpl('transit.stop.towards', row.towards)]
          .filter((part): part is string => part !== null)
          .join(' · ')
      : null;

  let detail: string;
  let isLastRun = false;
  if (row.kind === 'live') {
    detail = row.arrival ? formatArrivalText(row.arrival.text, translate) : t('realtime.arrival.noInfo');
    isLastRun = row.arrival?.isLastRun ?? false;
  } else if (row.operation !== 'running') {
    detail = t('transit.noService');
  } else if (!row.next) {
    detail = t('transit.stop.noService');
  } else {
    const at = row.next.atMs === null ? null : kstClockOf(row.next.atMs);
    const when = at === null ? kstClockOf(row.next.runDepartureAtMs) : at;
    detail = tpl(row.isAlightOnly ? 'transit.stop.arrivesAt' : 'transit.stop.departsAt', when);
    if (row.next.isEstimate) detail = `${detail} (${t('transit.stop.estimated')})`;
    isLastRun = row.next.isLastRun;
  }

  return (
    <View style={styles.row}>
      <View style={styles.titleRow}>
        <Txt typography="t5" fontWeight="bold" color="neutral" numberOfLines={1} style={styles.label}>
          {row.label}
        </Txt>
        {row.isAlightOnly && (
          <Badge size="xsmall" color="warning" backgroundColor="warningWeak">
            {t('transit.stop.alightOnly')}
          </Badge>
        )}
        {isLastRun && (
          <Badge size="xsmall" color="critical" backgroundColor="criticalWeak">
            {t('realtime.lastBus')}
          </Badge>
        )}
      </View>
      {heading ? (
        <Txt typography="t2" color="neutralSubtle" numberOfLines={1}>
          {heading}
        </Txt>
      ) : null}
      <Txt typography="t3" color="neutralMuted" numberOfLines={1}>
        {detail}
      </Txt>
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  row: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingVertical: SdsSpacing.x3,
    gap: SdsSpacing.x0_5,
    borderBottomWidth: 0.5,
    borderBottomColor: color.stroke.neutralWeak,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x1_5,
  },
  label: {
    flexShrink: 1,
  },
}));
