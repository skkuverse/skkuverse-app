import { View } from 'react-native';
import { WarningCircleIcon } from 'phosphor-react-native';
import { SdsSpacing } from '@skkuverse/shared';
import type { FgColorName } from '@skkuverse/shared';
import { Badge, Pressable, Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import type { SketchRow, SketchTokenTone } from './notice-sketch.types';

const TOKEN_COLOR: Record<SketchTokenTone, FgColorName> = {
  urgent: 'critical',
  today: 'brandContrast',
  cancelled: 'neutralSubtle',
  postponed: 'informativeContrast',
  closed: 'neutralSubtle',
  stopped: 'warningContrast',
  extended: 'informativeContrast',
  changed: 'informativeContrast',
  plain: 'neutral',
};

export function SketchRowItem({ row, onPress }: { row: SketchRow; onPress: (row: SketchRow) => void }) {
  const styles = useStyles();
  const color = useSemanticColors();
  const ink: FgColorName = row.dimmed ? 'neutralSubtle' : 'neutral';
  const sub: FgColorName = row.dimmed ? 'placeholder' : 'neutralSubtle';

  return (
    <Pressable bg="layerDefault" style={styles.row} onPress={() => onPress(row)}>
      <View style={styles.line}>
        {row.token ? (
          <Txt typography="t5" fontWeight="bold" color={TOKEN_COLOR[row.token.tone]}>
            {row.token.text}
          </Txt>
        ) : null}
        <Txt typography="t5" fontWeight="bold" color={ink} numberOfLines={1} style={styles.shrink}>
          {row.title}
        </Txt>
        {row.englishOnly ? (
          <Badge size="xsmall" color="neutralSubtle" backgroundColor="neutralWeak">
            EN
          </Badge>
        ) : null}
      </View>
      <View style={styles.line}>
        {row.dateMark === 'warning' ? <WarningCircleIcon size={14} color={color.fg.warning} weight="fill" /> : null}
        <Txt typography="t4" color={sub} numberOfLines={1} style={styles.shrink}>
          {row.when ? (
            <Txt
              typography="t4"
              fontWeight={row.urgent || row.dateMark === 'abstain' ? 'bold' : 'regular'}
              color={row.urgent ? 'critical' : row.dateMark === 'abstain' ? 'warningContrast' : sub}
            >
              {row.when}
            </Txt>
          ) : null}
          {row.when && row.qualifier ? ' · ' : ''}
          {row.qualifier ?? ''}
        </Txt>
        {row.board ? (
          <Txt typography="t2" color="placeholder" numberOfLines={1}>
            {row.board}
          </Txt>
        ) : null}
      </View>
    </Pressable>
  );
}

const useStyles = createThemedStyles(() => ({
  row: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingVertical: SdsSpacing.x3,
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
}));
