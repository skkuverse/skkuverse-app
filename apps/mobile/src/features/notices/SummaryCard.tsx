import { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import { logAiSummaryView } from '@/platform/analytics';
import { readNow } from '@/platform/clock';
import { NoticeTimeline } from './components/NoticeTimeline';
import { buildNoticeTimeline } from './timeline.rules';
import type { NoticeDetailSummary } from './notices.types';

interface Props {
  summary: NoticeDetailSummary;
  sourceId: string;
  articleNo: number;
}

interface MetaRow {
  label: string;
  value: string;
}

/**
 * WHY: conclusion first, then evidence, then prose: the reader asks "is this for me, what do I do,
 * by when", and the old body-first order answered those last.
 */
export function SummaryCard({ summary, sourceId, articleNo }: Props) {
  const { t } = useT();

  // WHY: once per (notice, summary type), so a refetch with an unchanged classification logs nothing.
  useEffect(() => {
    // WHY: a summary the server derived from facts carries no model and is not an AI view.
    if (summary.model === null) return;
    logAiSummaryView({
      sourceId,
      articleNo,
      summaryType: summary.type,
      hasOneLiner: !!summary.oneLiner?.trim(),
      hasPeriods: summary.periods.length > 0,
      hasLocations: summary.locations.length > 0,
      hasDetails: summary.details != null,
      model: summary.model,
    });
  }, [sourceId, articleNo, summary.type]); // eslint-disable-line react-hooks/exhaustive-deps -- one log per notice and summary type, not per re-render

  const { entries } = useMemo(
    // WHY: keyed on periods alone, so a background refetch never redraws the timeline; past
    // midnight the D-day updates a render late.
    () => buildNoticeTimeline(summary.periods, new Date(readNow())),
    [summary.periods],
  );

  // WHY: one table in the conclusion area; split into two, the same label-value grammar appeared twice
  // and read as a break. Row order follows the reader's questions: target, action, place, host, impact.
  const details = summary.details;
  const metaRows: MetaRow[] = [];
  if (details?.target)
    metaRows.push({ label: t('notices.detailLabelTarget'), value: details.target });
  if (details?.action)
    metaRows.push({ label: t('notices.detailLabelAction'), value: details.action });
  for (const loc of summary.locations) {
    metaRows.push({
      label: t('notices.detailLabelLocation'),
      value: loc.label ? `${loc.label}: ${loc.detail}` : loc.detail,
    });
  }
  if (details?.host)
    metaRows.push({ label: t('notices.detailLabelHost'), value: details.host });
  if (details?.impact)
    metaRows.push({ label: t('notices.detailLabelImpact'), value: details.impact });

  return (
    <>
      {/* WHY: readers come to check, not to read, so the table and the schedule lead and the body follows. */}
      <MetaList rows={metaRows} />
      <NoticeTimeline entries={entries} />

      {summary.text ? (
        <Txt
          typography="t6"
          color="neutral"
          // WHY: with no timeline the body sits right under the table, so it needs more room above.
          style={[styles.body, entries.length === 0 && styles.bodyAfterTable]}
          lineBreakStrategyIOS="hangul-word"
        >
          {summary.text}
        </Txt>
      ) : null}
    </>
  );
}

/** WHY: no border or dividers: on this screen a border marks something pressable. */
function MetaList({ rows }: { rows: MetaRow[] }) {
  if (rows.length === 0) return null;

  return (
    <View style={styles.metaList}>
      {rows.map((row, i) => (
        <View key={`${row.label}-${i}`} style={styles.metaRow}>
          <Txt
            typography="t3"
            color="neutralSubtle"
            style={styles.metaLabel}
            // WHY: without it a narrow fixed-width label breaks mid-word.
            lineBreakStrategyIOS="hangul-word"
          >
            {row.label}
          </Txt>
          <Txt
            typography="t3"
            color="neutral"
            style={styles.metaValue}
            lineBreakStrategyIOS="hangul-word"
          >
            {row.value}
          </Txt>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    // WHY: the timeline's last row already pads 16, so the effective gap is about 20.
    marginTop: SdsSpacing.x1,
    // WHY: what follows is a list (refs, attachments), a transition that wants more air than above.
    marginBottom: SdsSpacing.x3,
  },
  bodyAfterTable: {
    marginTop: SdsSpacing.x5,
  },
  metaList: {
    marginTop: SdsSpacing.x5,
    gap: SdsSpacing.x2_5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    // WHY: no horizontal padding, or the rows stop aligning with the body above and the attachments below.
  },
  metaLabel: {
    // WHY: 76 fits the remaining labels (place, target, action, host, impact) on one line.
    width: 76,
    flexShrink: 0,
    marginRight: SdsSpacing.x3,
  },
  metaValue: {
    flex: 1,
  },
});
