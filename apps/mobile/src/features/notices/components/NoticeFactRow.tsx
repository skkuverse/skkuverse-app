import { View } from 'react-native';
import { WarningCircleIcon } from 'phosphor-react-native';
import { SdsSpacing, type FgColorName } from '@skkuverse/shared';
import { ListRow, Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import type { NoticeListRow, NoticeListRowTone } from '../notice-facts.types';
import type { NoticeListItem } from '../notices.types';
import { HighlightedText } from './HighlightedText';

interface Props {
  item: NoticeListItem;
  row: NoticeListRow;
  onPress: (item: NoticeListItem) => void;
  highlightQuery?: string;
}

/** WHY: only a deadline takes the urgency ink; a status that ended the call reads as quiet as the dimmed row. */
const TOKEN_INK: Record<NoticeListRowTone, FgColorName> = {
  urgent: 'critical',
  today: 'brandContrast',
  cancelled: 'neutralSubtle',
  closed: 'neutralSubtle',
  stopped: 'warningContrast',
  postponed: 'informativeContrast',
  extended: 'informativeContrast',
  changed: 'informativeContrast',
};

export function NoticeFactRow({ item, row, onPress, highlightQuery }: Props) {
  const styles = useStyles();
  const color = useSemanticColors();
  const ink: FgColorName = row.isDimmed ? 'neutralSubtle' : 'neutral';
  const subInk: FgColorName = row.isDimmed ? 'placeholder' : 'neutralSubtle';
  const isWhenLoud = row.isUrgent || row.dateMark === 'abstain';
  const whenInk: FgColorName = row.isUrgent ? 'critical' : row.dateMark === 'abstain' ? 'warningContrast' : subInk;
  const hasSecondLine = row.when !== null || row.qualifier !== null || row.board !== null;

  return (
    <ListRow
      onPress={() => onPress(item)}
      style={styles.row}
      containerStyle={styles.container}
      contents={
        <View style={styles.contents}>
          <View style={styles.line}>
            {row.token ? (
              <Txt typography="t5" fontWeight="bold" color={row.token.tone ? TOKEN_INK[row.token.tone] : 'neutral'}>
                {row.token.text}
              </Txt>
            ) : null}
            <HighlightedText
              typography="t5"
              fontWeight="bold"
              color={ink}
              numberOfLines={1}
              style={styles.shrink}
              text={row.title}
              query={highlightQuery}
            />
          </View>
          {hasSecondLine ? (
            <View style={styles.line}>
              {row.dateMark === 'warning' ? (
                <WarningCircleIcon size={14} color={color.fg.warning} weight="fill" />
              ) : null}
              <Txt typography="t4" color={subInk} numberOfLines={1} style={styles.shrink}>
                {row.when !== null ? (
                  <Txt typography="t4" fontWeight={isWhenLoud ? 'bold' : 'regular'} color={whenInk}>
                    {row.when}
                  </Txt>
                ) : null}
                {row.when !== null && row.qualifier !== null ? ' · ' : null}
                {row.qualifier}
              </Txt>
              {row.board !== null ? (
                <Txt typography="t2" color="placeholder" numberOfLines={1} style={styles.board}>
                  {row.board}
                </Txt>
              ) : null}
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
    paddingVertical: SdsSpacing.x3,
  },
  contents: {
    gap: SdsSpacing.x1,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x1_5,
  },
  shrink: {
    flexShrink: 1,
  },
  // WHY: the board yields room to the date and qualifier, which carry the decision.
  board: {
    flexShrink: 0,
    maxWidth: '40%',
  },
}));
