import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSettingsStore, type Campus } from '@skkuverse/shared';
import { useNow } from '@/platform/clock';
import { logMealsContentSelect } from '@/platform/analytics';
import { mealsDailyQueryOptions } from './meals.client';
import {
  decideMealForHour,
  toKstDate,
  toMealsScreenCafeterias,
  toMealsScreenTabs,
  toWeekDates,
  toWeekday,
} from './meals.rules';
import type { MealsCode, MealsScreenCafeteria, MealsScreenDay, MealsScreenTab } from './meals.types';

export type MealsStatus = 'loading' | 'error' | 'ready';

export function useMeals(): {
  status: MealsStatus;
  campus: Campus;
  onCampusChange: (campus: Campus) => void;
  weeks: MealsScreenDay[][];
  initialWeek: number;
  date: string;
  onDateChange: (date: string) => void;
  cafeterias: { id: string; title: string }[];
  cafeteria?: MealsScreenCafeteria;
  tabs: MealsScreenTab[];
  onCafeteriaChange: (id: string) => void;
  onMealTabSelect: (code: MealsCode) => void;
  onFixedMenuExpand: (code: MealsCode) => void;
  landingCode?: MealsCode;
  onRetry: () => void;
} {
  const lang = useSettingsStore((s) => s.appLanguage) === 'ko' ? 'ko' : 'en';
  const preferredCampus = useSettingsStore((s) => s.preferredCampus);
  const now = useNow(60_000);
  const today = toKstDate(now);
  const [campus, setCampus] = useState<Campus>(preferredCampus);
  const [date, setDate] = useState(today);
  const [pickedId, setPickedId] = useState<string>();
  const query = useQuery(mealsDailyQueryOptions(campus, date));

  const cafeterias = useMemo(() => (query.data ? toMealsScreenCafeterias(query.data, lang) : undefined), [query.data, lang]);
  const cafeteria = cafeterias?.find((c) => c.id === pickedId) ?? cafeterias?.[0];
  const hourCode = decideMealForHour(now);
  const weeks = useMemo(
    () =>
      [-1, 0, 1].map((shift) =>
        toWeekDates(today, shift).map((d) => ({ date: d, day: Number(d.slice(8)), weekday: toWeekday(d), isToday: d === today })),
      ),
    [today],
  );

  return {
    status: cafeterias ? 'ready' : query.isError ? 'error' : 'loading',
    campus,
    // WHY: a re-tap of the current choice is logged nowhere, as the shuttle's DayGrid does.
    onCampusChange: (next) => {
      if (next !== campus) logMealsContentSelect({ content_type: 'meals_campus', item_id: next });
      setCampus(next);
    },
    weeks,
    initialWeek: 1,
    date,
    onDateChange: (next) => {
      if (next !== date) logMealsContentSelect({ content_type: 'meals_day', item_id: next });
      setDate(next);
    },
    cafeterias: cafeterias?.map(({ id, title }) => ({ id, title })) ?? [],
    cafeteria,
    tabs: cafeteria ? toMealsScreenTabs(cafeteria, date === today, now) : [],
    onCafeteriaChange: (id) => {
      if (id !== cafeteria?.id) logMealsContentSelect({ content_type: 'meals_cafeteria', item_id: id });
      setPickedId(id);
    },
    onMealTabSelect: (code) => logMealsContentSelect({ content_type: 'meals_tab', item_id: code }),
    onFixedMenuExpand: (code) =>
      logMealsContentSelect({ content_type: 'meals_fixed_menu', item_id: `${cafeteria?.id ?? ''}:${code}` }),
    landingCode: date === today && cafeteria?.meals.some((m) => m.code === hourCode) ? hourCode : undefined,
    onRetry: () => void query.refetch(),
  };
}
