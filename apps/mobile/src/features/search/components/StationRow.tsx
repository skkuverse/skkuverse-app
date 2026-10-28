import { TrainIcon } from 'phosphor-react-native';
import { ListRow, useSemanticColors } from '@skkuverse/sds';
import type { SubwayStation } from '@/features/transit/subway/subway.types';
import { RESULT_ROW_INSET, ResultMark } from './ResultRow';

interface StationRowProps {
  station: SubwayStation;
  onPress: () => void;
}

export function StationRow({ station, onPress }: StationRowProps) {
  const color = useSemanticColors();

  return (
    <ListRow
      containerStyle={RESULT_ROW_INSET}
      withArrow
      accessibilityRole="button"
      left={
        <ResultMark>
          <TrainIcon size={20} color={color.fg.neutralSubtle} weight="fill" />
        </ResultMark>
      }
      contents={
        <ListRow.Texts
          layout="2RowTypeA"
          top={station.title}
          topProps={{ typography: 't5' }}
          bottom={station.lines.map((l) => l.name).join(' · ')}
          bottomProps={{ typography: 't3' }}
        />
      }
      onPress={onPress}
    />
  );
}
