import { Fragment } from 'react';
import { View } from 'react-native';
import { useT, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { ListRow, Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import type { FgColorName } from '@skkuverse/shared';
import { EyeIcon } from 'phosphor-react-native';
import { readNow } from '@/platform/clock';
import { formatDeadlineBadge } from './deadline.rules';
import { formatListDate } from './notice-date.rules';
import { HighlightedText } from './components/HighlightedText';
import type { NoticeListItem } from './notices.types';

interface Props {
  item: NoticeListItem;
  onPress: (item: NoticeListItem) => void;
  showDepartment?: boolean;
  highlightQuery?: string;
}

/**
 * WHY: the one accent color in the row; a passed deadline drops to neutral, since brand ink on it
 * would read as a live call to action.
 */
function formatDeadline(
  item: NoticeListItem,
): { text: string; expired: boolean } | null {
  const info = formatDeadlineBadge(item.summary ?? null, new Date(readNow()));
  if (!info) return null;
  return {
    text: info.context ? `${info.pill.text} · ${info.context}` : info.pill.text,
    expired: info.pill.variant === 'closed',
  };
}

// QUIRK(hermes): `toLocaleString` depends on whether the build compiled Intl in; a regex is the same everywhere.
function formatViews(views: number): string {
  return String(views).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// WHY: the chip is pulled left by its own padding, so its text, not its box, lines up with the title.
const DEPT_CHIP_PADDING_X = 6;

export function NoticeRow({
  item,
  onPress,
  showDepartment,
  highlightQuery,
}: Props) {
  const styles = useStyles();
  const semantic = useSemanticColors();
  const footerColor = semantic.fg.neutralSubtle;
  const { t } = useT();
  const deadlineColor = 'brandContrast';
  const oneLiner = item.summary?.oneLiner?.trim() ?? '';
  // WHY: an empty line makes rows ragged and reads as "not loaded yet", so point at the content instead.
  const summaryText =
    oneLiner ||
    (item.hasAttachments
      ? t('notices.summaryFallbackAttachment')
      : t('notices.summaryFallback'));
  const deadline = formatDeadline(item);
  const dateText = formatListDate(item.date);
  const deptLabel = showDepartment ? item.department : undefined;
  // WHY: only top-level facts get a pipe; the deadline keeps its inner "·" because its label modifies the D-day.
  const footerSegments: { text: string; color: FgColorName }[] = [];
  if (dateText) footerSegments.push({ text: dateText, color: 'neutralSubtle' });
  if (deadline) {
    footerSegments.push({
      text: deadline.text,
      color: deadline.expired ? 'neutralSubtle' : deadlineColor,
    });
  }
  // WHY: a bookmark synthesizes `views: 0`, so zero means unknown and shows nothing.
  const viewsText = item.views > 0 ? formatViews(item.views) : null;

  return (
    <ListRow
      onPress={() => onPress(item)}
      style={styles.row}
      containerStyle={styles.container}
      contents={
        <View style={styles.contents}>
          {/* WHY: a row wrapper, not the bare chip: `flexShrink` truncates only on a flex main axis,
              and in the column a long department name would overflow. */}
          {deptLabel ? (
            <View style={styles.metaRow}>
              <View style={styles.deptChip}>
                <Txt typography="t1" fontWeight="medium" color="neutralSubtle" numberOfLines={1}>
                  {deptLabel}
                </Txt>
              </View>
            </View>
          ) : null}
          {/* WHY: the title is capped at one line so every row's first line starts at the same y. */}
          <HighlightedText
            typography="t4"
            fontWeight="bold"
            color="neutral"
            numberOfLines={1}
            text={item.title}
            query={highlightQuery}
          />
          {/* QUIRK(ios): `standard` (0xFFFF) includes HangulWordPriority. QUIRK(android): `balanced` is
              Android only; iOS has no balanced wrapping, which is a platform ceiling, not a bug here. */}
          {summaryText.length > 0 ? (
            <Txt
              typography="t4"
              color="neutral"
              numberOfLines={2}
              lineBreakStrategyIOS="standard"
              textBreakStrategy="balanced"
            >
              {summaryText}
            </Txt>
          ) : null}
          {/* WHY: separators are 1pt Views, not "|" glyphs, which are never optically centered against digits. */}
          {(viewsText || footerSegments.length > 0) ? (
            <View style={styles.footerRow}>
              {viewsText ? (
                <>
                  <EyeIcon
                    size={13}
                    color={footerColor}
                    style={styles.footerIcon}
                  />
                  <Txt
                    typography="t2"
                    color="neutralSubtle"
                    numberOfLines={1}
                    style={[styles.tabular, styles.viewsText]}
                  >
                    {viewsText}
                  </Txt>
                </>
              ) : null}
              {footerSegments.map((segment, i) => (
                <Fragment key={segment.text}>
                  {(viewsText || i > 0) ? (
                    <View style={styles.footerSep} />
                  ) : null}
                  <Txt
                    typography="t2"
                    fontWeight={
                      segment.color === deadlineColor ? 'medium' : 'regular'
                    }
                    color={segment.color}
                    numberOfLines={1}
                    style={styles.tabular}
                  >
                    {segment.text}
                  </Txt>
                </Fragment>
              ))}
            </View>
          ) : null}
        </View>
      }
    />
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  row: {
    backgroundColor: color.bg.layerDefault,
  },
  container: {
    paddingVertical: SdsSpacing.x4,
  },
  // WHY: no `gap`: chip to title, title to summary and summary to footer are different relationships.
  contents: {},
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SdsSpacing.x2_5,
  },
  // WHY: `marginLeft` cancels the padding, so the chip's first glyph lands on the title's x.
  deptChip: {
    alignSelf: 'flex-start',
    flexShrink: 1,
    backgroundColor: color.bg.neutralWeak,
    paddingHorizontal: DEPT_CHIP_PADDING_X,
    marginLeft: -DEPT_CHIP_PADDING_X,
    paddingVertical: SdsSpacing.x0_5,
    borderRadius: SdsRadius.r1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SdsSpacing.x2_5,
  },
  footerIcon: {
    marginRight: SdsSpacing.x1,
  },
  // EVIDENCE: WantedSans' proportional digits run 880 to 1280 units wide, so without `tnum` the
  // separators after "11/11" and "07/30" never line up.
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  // EVIDENCE: three tabular digits at 12pt are 22.5pt; a count of 1,000 or more overflows and pushes
  // its separator, accepted over reserving dead space.
  viewsText: {
    minWidth: 23,
  },
  // WHY: a crisp 1pt fill reads heavier than an antialiased glyph, so text ink would outshout the data.
  footerSep: {
    width: 1,
    height: 10,
    backgroundColor: color.stroke.neutralWeak,
    marginHorizontal: SdsSpacing.x2_5,
  },
}));

