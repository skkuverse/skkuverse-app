import { View } from 'react-native';
import { BusIcon } from 'phosphor-react-native';
import { SdsSpacing, useT } from '@skkuverse/shared';
import { ListRow, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import { toDirectionLabel, type StopNameResult, type StopPoleResult } from '../search.rules';
import { RESULT_MARK_SIZE, RESULT_ROW_INSET, ResultMark } from './ResultRow';

interface StopRowsProps {
  stop: StopNameResult;
  onPolePress: (pole: StopPoleResult) => void;
}

export function StopRows({ stop, onPolePress }: StopRowsProps) {
  const color = useSemanticColors();
  const styles = useStyles();
  const { t, tpl } = useT();

  return (
    <View>
      <ListRow
        containerStyle={RESULT_ROW_INSET}
        left={
          <ResultMark>
            <BusIcon size={20} color={color.fg.neutralSubtle} weight="fill" />
          </ResultMark>
        }
        contents={
          stop.campus ? (
            <ListRow.Texts
              layout="2RowTypeA"
              top={stop.name}
              topProps={{ typography: 't5' }}
              bottom={t(`campus.${stop.campus}`)}
              bottomProps={{ typography: 't3' }}
            />
          ) : (
            <ListRow.Texts layout="1RowTypeA" top={stop.name} topProps={{ typography: 't5' }} />
          )
        }
      />
      {stop.poles.map((pole) => {
        const direction = toDirectionLabel(pole.directions, t, tpl);
        return (
          <ListRow
            key={pole.stopId}
            verticalPadding="xsmall"
            containerStyle={styles.poleRow}
            withArrow
            accessibilityRole="button"
            accessibilityLabel={`${stop.name}, ${direction}`}
            left={<View style={styles.markSpacer} />}
            contents={
              <ListRow.Texts
                layout="2RowTypeE"
                top={direction}
                topProps={{ typography: 't4' }}
                bottom={pole.routeLabels.join(' · ')}
              />
            }
            onPress={() => onPolePress(pole)}
          />
        );
      })}
    </View>
  );
}

const useStyles = createThemedStyles(() => ({
  poleRow: {
    paddingHorizontal: SdsSpacing.gutter,
  },
  markSpacer: {
    width: RESULT_MARK_SIZE,
  },
}));
