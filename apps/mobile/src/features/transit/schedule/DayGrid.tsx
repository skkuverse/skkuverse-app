import { View } from 'react-native';
import { useT, TranslationKey, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { Pressable, Txt, createThemedStyles } from '@skkuverse/sds';
import { logBusContentSelect } from '@/platform/analytics';
import type { DaySchedule } from '../transit.types';

const DAY_KEYS: Record<number, TranslationKey> = {
  1: 'day.mon', 2: 'day.tue', 3: 'day.wed', 4: 'day.thu', 5: 'day.fri', 6: 'day.sat', 7: 'day.sun',
};

interface DayGridProps {
  days: DaySchedule[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function DayGrid({ days, selectedIndex, onSelect }: DayGridProps) {
  const styles = useStyles();
  const { t } = useT();
  return (
    <View style={styles.container}>
      {days.map((day, index) => {
        const isSelected = index === selectedIndex;
        const dayNumber = Number(day.date.split('-')[2]);

        return (
          <Pressable
            key={day.date}
            // WHY: the fill shows the selected day, so a press only shrinks the cell (PRESS-06).
            bg={isSelected ? 'neutralInverted' : 'transparent'}
            feedback="scale"
            style={styles.cell}
            onPress={() => {
              if (!isSelected) {
                logBusContentSelect({ content_type: 'schedule_day', item_id: day.date });
              }
              onSelect(index);
            }}
          >
            <Txt
              typography="t5"
              fontWeight="bold"
              color={isSelected ? 'neutralInverted' : 'neutral'}
            >
              {String(dayNumber)}
            </Txt>
            <Txt
              typography="t3"
              fontWeight="medium"
              color={isSelected ? 'neutralInvertedMuted' : 'neutralSubtle'}
            >
              {DAY_KEYS[day.dayOfWeek] ? t(DAY_KEYS[day.dayOfWeek]) : String(day.dayOfWeek)}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = createThemedStyles(() => ({
  container: {
    flexDirection: 'row',
    gap: SdsSpacing.x1,
  },
  cell: {
    flex: 1,
    minWidth: 36,
    flexDirection: 'row',
    paddingVertical: SdsSpacing.x2,
    borderRadius: SdsRadius.r2_5,
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: SdsSpacing.x1,
  },
}));
