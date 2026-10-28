import { useEffect, useRef, type Ref } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  useT,
  SdsRadius,
  SdsSpacing,
} from '@skkuverse/shared';
import { Txt, createThemedStyles } from '@skkuverse/sds';
import { track } from '@/platform/analytics';
import { ScheduleRow } from './ScheduleRow';
import { attachmentsFor, isNewAttachmentView, toRunKey } from './run-attachments.rules';
import { isPastBus, hasMultipleRouteTypes } from './schedule.rules';
import { SHOW_CROWDING, TIMETABLE_COLUMNS } from './schedule.constants';
import type { OnStationPress, TimetableLayout } from './schedule.types';
import { runStops } from './schedule-config.rules';
import type { BoardingStop, BusService, ScheduleEntry, RouteBadge } from '../transit.types';

interface ScheduleListProps {
  entries: ScheduleEntry[];
  routeBadges: RouteBadge[];
  isToday: boolean;
  now: number;
  nextEntryIndex?: number;
  showFooter?: boolean;
  sequences?: BusService['stopSequences'];
  layout?: TimetableLayout;
  attachmentSources?: { catalog: readonly BoardingStop[]; serviceId: string; date: string };
  nextRowRef?: Ref<View>;
  onNextRowLayout?: () => void;
  onStationPress: OnStationPress;
}

export function ScheduleList({
  entries,
  routeBadges,
  isToday,
  now,
  nextEntryIndex,
  showFooter = true,
  sequences,
  layout = 'v1',
  attachmentSources,
  nextRowRef,
  onNextRowLayout,
  onStationPress,
}: ScheduleListProps) {
  const styles = useStyles();
  const { t, tpl } = useT();
  const sectioned = layout === 'sectioned';
  const showBadge = hasMultipleRouteTypes(entries);
  const runs = entries.map((entry) => runStops(entry, sequences));
  const attached = entries.map((entry, i) =>
    attachmentSources
      ? {
          runKey: toRunKey(attachmentSources.serviceId, attachmentSources.date, entry),
          placed: attachmentsFor(entry, runs[i], now, attachmentSources),
        }
      : null,
  );

  const seenViews = useRef(new Set<string>());
  useEffect(() => {
    for (const run of attached) {
      for (const { items } of run?.placed ?? []) {
        for (const { kind, id, instanceId } of items) {
          if (isNewAttachmentView(seenViews.current, instanceId)) {
            track('schedule_attachment_view', { kind, id, run_key: run!.runKey });
          }
        }
      }
    }
  });

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.dotColumnHeader} />
        <Txt
          typography="t1"
          fontWeight="semiBold"
          color="placeholder"
          style={sectioned ? styles.gridTime : styles.headerTime}
        >
          {t('transit.time')}
        </Txt>
        {sectioned ? null : <View style={styles.headerBadgeSlot} />}
        {showBadge && (
          <Txt typography="t1" fontWeight="semiBold" color="placeholder" style={styles.headerRoute}>
            {t('transit.route')}
          </Txt>
        )}
        <Txt
          typography="t1"
          fontWeight="semiBold"
          color="placeholder"
          textAlign={sectioned ? 'center' : undefined}
          numberOfLines={sectioned ? 1 : undefined}
          style={sectioned && styles.gridCount}
        >
          {t('transit.buses')}
        </Txt>
        <Txt
          typography="t1"
          fontWeight="semiBold"
          color="placeholder"
          style={[
            styles.headerNotes,
            sectioned ? styles.gridNotes : !showBadge && styles.headerNotesExtraMargin,
          ]}
        >
          {t('transit.notes')}
        </Txt>
        {SHOW_CROWDING && (
          <Txt
            typography="t1"
            fontWeight="semiBold"
            color="placeholder"
            textAlign="center"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={styles.headerCrowding}
          >
            {t('transit.crowding')}
          </Txt>
        )}
      </View>

      {entries.map((entry, index) => {
        const isNext = isToday && entry.index === nextEntryIndex;
        return (
          <View
            key={entry.index}
            ref={isNext ? nextRowRef : undefined}
            onLayout={isNext ? onNextRowLayout : undefined}
          >
            <ScheduleRow
              entry={entry}
              stops={runs[index]}
              isPast={isPastBus(entry, isToday, sequences, now)}
              isNext={isNext}
              isToday={isToday}
              now={now}
              routeBadges={routeBadges}
              showBadge={showBadge}
              layout={layout}
              attachments={attached[index]?.placed}
              runKey={attached[index]?.runKey}
              onStationPress={onStationPress}
            />
            {index < entries.length - 1 && <View style={styles.separator} />}
          </View>
        );
      })}

      {showFooter ? (
        <Txt typography="t2" color="placeholder" textAlign="center" style={styles.footer}>
          {tpl('schedule.footer', entries.length)}
        </Txt>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  card: {
    marginHorizontal: SdsSpacing.gutter,
    marginTop: SdsSpacing.x3,
    backgroundColor: color.bg.layerDefault,
    borderRadius: SdsRadius.r4,
    overflow: 'hidden',
    paddingBottom: SdsSpacing.x4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SdsSpacing.gutter,
    paddingVertical: SdsSpacing.x2,
    backgroundColor: color.bg.neutralMuted,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.stroke.neutralSubtle,
    gap: SdsSpacing.x2_5,
  },
  dotColumnHeader: {
    width: 16,
  },
  headerTime: {
    minWidth: 44,
  },
  headerBadgeSlot: {
    width: 42,
  },
  headerRoute: {
    width: TIMETABLE_COLUMNS.route,
    textAlign: 'center',
  },
  gridTime: {
    width: TIMETABLE_COLUMNS.time,
  },
  gridCount: {
    width: TIMETABLE_COLUMNS.count,
  },
  gridNotes: {
    marginLeft: TIMETABLE_COLUMNS.notesInset,
  },
  headerNotes: {
    flex: 1,
  },
  headerCrowding: {
    width: TIMETABLE_COLUMNS.crowding,
  },
  headerNotesExtraMargin: {
    marginLeft: SdsSpacing.x3_5,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.stroke.neutralSubtle,
    marginLeft: SdsSpacing.gutter,
  },
  footer: {
    paddingVertical: SdsSpacing.x3,
  },
}));
