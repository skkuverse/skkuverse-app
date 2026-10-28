import { useState } from 'react';
import { ScrollView, View, type LayoutChangeEvent } from 'react-native';
import { SdsRadius, SdsSpacing, useT, type TranslationKey } from '@skkuverse/shared';
import { Pressable, Txt, createThemedStyles } from '@skkuverse/sds';
import type { MealsScreenDay } from '../meals.types';

const WEEKDAY_KEYS: TranslationKey[] = ['day.sun', 'day.mon', 'day.tue', 'day.wed', 'day.thu', 'day.fri', 'day.sat'];

export function DayStrip({
  weeks,
  initialWeek,
  selectedDate,
  onSelect,
}: {
  weeks: MealsScreenDay[][];
  initialWeek: number;
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const styles = useStyles();
  const { t } = useT();
  const [width, setWidth] = useState(0);

  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: initialWeek * width, y: 0 }}
        >
          {weeks.map((week) => (
            <View key={week[0]?.date} style={[styles.week, { width }]}>
              {week.map((day) => {
                const selected = day.date === selectedDate;
                return (
                  <Pressable
                    key={day.date}
                    // WHY: the fill shows the selected day, so a press only shrinks the cell (PRESS-06).
                    bg={selected ? 'neutralInverted' : 'transparent'}
                    feedback="scale"
                    style={styles.cell}
                    onPress={() => onSelect(day.date)}
                    accessibilityState={{ selected }}
                  >
                    <Txt typography="t2" fontWeight="medium" color={selected ? 'neutralInvertedMuted' : 'neutralSubtle'}>
                      {t(WEEKDAY_KEYS[day.weekday] ?? 'day.sun')}
                    </Txt>
                    <Txt
                      typography="t5"
                      fontWeight="bold"
                      color={selected ? 'neutralInverted' : day.isToday ? 'brand' : 'neutral'}
                    >
                      {String(day.day)}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = createThemedStyles(() => ({
  week: {
    flexDirection: 'row',
    gap: SdsSpacing.x1,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SdsSpacing.x2,
    borderRadius: SdsRadius.r3,
    gap: SdsSpacing.x0_5,
  },
}));
