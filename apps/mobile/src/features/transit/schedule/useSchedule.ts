import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'expo-router';
import {
  kstDate,
  useEngagementStore,
  useSettingsStore,
  useT,
} from '@skkuverse/shared';
import {
  logBusContentSelect,
  logBusRouteOpen,
  logBusServiceSwitch,
  track,
} from '@/platform/analytics';
import { asEntrySource, isPageReturn } from '@/platform/analytics.rules';
import { openMapPlace } from '@/features/web/web.service';
import { useNow } from '@/platform/clock';
import { useTransitLoadError } from '../components/useTransitLoadError';
import { useScheduleRefresh } from './useScheduleRefresh';
import { getNextBus } from './schedule.rules';
import type { OnStationPress, ScheduleSection } from './schedule.types';
import { groupDaysByWeek, findWeekAndDayIndex } from './week.rules';
import { resolveScheduleService } from './schedule-config.rules';
import { useBusConfig } from '../useBusConfig';
import { toInfoUrl } from '../transit.rules';

export function useSchedule(groupId: string, serviceParam: string | undefined, source: string | undefined) {
  const router = useRouter();
  const { t, tpl } = useT();
  const { data: config, isLoading: configLoading, isError: configError } = useBusConfig(groupId);
  // WHY: the config has no error UI; a failed one leaves the skeleton up.
  useTransitLoadError('bus_config', groupId, configError && !config);

  const isSchedule = config?.screenType === 'schedule';
  const screenConfig = isSchedule ? config.screen : undefined;

  // WHY: the server's `features[]` is the only source of the info URL; no group without an info page gets a
  // hardcoded fallback, or the header button shows on every bus.
  const infoUrl = screenConfig ? toInfoUrl(screenConfig.features) : undefined;
  const handleInfoPress = useCallback(() => {
    if (!infoUrl || !config) return;
    logBusContentSelect({ content_type: 'schedule_info', item_id: groupId ?? '' });
    router.push({
      pathname: '/webview',
      params: {
        title: config.label,
        color: config.card.themeColor,
        url: infoUrl,
      },
    } as never);
  }, [infoUrl, config, router, groupId]);

  // WHY: a timetable pushed back by closing a station resumes the visit: no second open, view or visit count.
  const returning = isPageReturn(source);

  useEffect(() => {
    if (!config || !groupId || returning) return;
    logBusRouteOpen({
      routeId: groupId,
      routeLabel: config.label,
      screenType: 'schedule',
      source: asEntrySource(source),
    });
  }, [config?.label, groupId]); // eslint-disable-line react-hooks/exhaustive-deps -- one open per route, not per change of entry source

  // WHY: counted on every schedule mount, for every group; the transit tab applies the threshold on re-focus.
  useEffect(() => {
    if (!returning) useEngagementStore.getState().incrementInjaShuttleVisit();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once per mount; a mount's source does not change

  // WHY: a chip tap runs in a transition and a store write never does, so the pick is written after the tap
  // rendered; a store read here would re-render the whole screen synchronously. Chips remember the last pick;
  // a segment is a direction, which changes with the time of day, so it is never remembered.
  const isChips = screenConfig?.serviceSelector === 'chips';
  const [tappedServiceId, setTappedServiceId] = useState<string | null>(null);
  const remembered = useSettingsStore((s) =>
    isChips && groupId && tappedServiceId === null ? s.lastServiceByGroup[groupId] : undefined,
  );
  const [activeSection, setActiveSection] = useState<ScheduleSection>('timetable');
  const routeTappedFromBoardingRef = useRef(false);
  const resolved = screenConfig
    ? resolveScheduleService(screenConfig.services, {
        tapped: tappedServiceId,
        param: serviceParam,
        remembered,
        defaultId: screenConfig.defaultServiceId,
      })
    : undefined;
  const currentService = resolved?.service;
  const selectedServiceIndex =
    screenConfig && currentService ? screenConfig.services.indexOf(currentService) : 0;

  const selectService = (serviceId: string) => {
    if (!groupId) return;
    logBusServiceSwitch(groupId, serviceId);
    routeTappedFromBoardingRef.current =
      serviceId !== currentService?.serviceId && activeSection === 'boarding';
    setTappedServiceId(serviceId);
  };

  useEffect(() => {
    if (isChips && groupId && tappedServiceId) {
      useSettingsStore.getState().setLastService(groupId, tappedServiceId);
    }
  }, [isChips, groupId, tappedServiceId]);

  const shownServiceId = currentService?.serviceId;
  const shownSource = resolved?.source;
  const skipFirstView = useRef(returning);
  // WHY: the first service shown is counted too, since demand per route would miss every rider who never taps.
  useEffect(() => {
    if (!groupId || !shownServiceId || !shownSource) return;
    if (skipFirstView.current) {
      skipFirstView.current = false;
      return;
    }
    track('bus_service_view', { route_id: groupId, service_id: shownServiceId, source: shownSource });
  }, [groupId, shownServiceId]); // eslint-disable-line react-hooks/exhaustive-deps -- once per service, not per source change

  const {
    scheduleQuery: { data: schedule, isError: scheduleError, refetch: refetchSchedule },
    refresh,
  } = useScheduleRefresh(currentService);
  const scheduleLoad = useTransitLoadError(
    'bus_schedule',
    currentService?.serviceId,
    scheduleError && !schedule,
    refetchSchedule,
  );

  // WHY: one clock for the screen, so the next run and the past rows can never disagree.
  const now = useNow(30_000);

  const scheduleDays = schedule?.days;
  const serverSelectedDate = schedule?.selectedDate;
  const weeks = useMemo(() => {
    if (!scheduleDays?.length) return [];
    return groupDaysByWeek(scheduleDays, t, tpl);
  }, [scheduleDays, t, tpl]);

  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [selectedDayInWeekIndex, setSelectedDayInWeekIndex] = useState(0);

  // WHY: keyed by service, server day and dates, never by the days' contents: a refresh brings new estimates
  // for the same dates and must leave the rider's picked day alone.
  const syncKey = [
    currentService?.endpoint ?? '',
    serverSelectedDate ?? '',
    scheduleDays?.map((d) => d.date).join(',') ?? '',
  ].join('|');
  const [syncedKey, setSyncedKey] = useState<string | null>(null);
  if (syncedKey !== syncKey) {
    setSyncedKey(syncKey);
    if (scheduleDays?.length && weeks.length > 0) {
      const serverIndex = serverSelectedDate
        ? scheduleDays.findIndex((d) => d.date === serverSelectedDate)
        : 0;
      const flatIndex = serverIndex >= 0 ? serverIndex : 0;
      const { weekIndex, dayInWeekIndex } = findWeekAndDayIndex(weeks, flatIndex);
      setCurrentWeekIndex(weekIndex);
      setSelectedDayInWeekIndex(dayInWeekIndex);
    }
  }

  const currentWeek = weeks[currentWeekIndex];
  const selectedDayIndex = currentWeek
    ? currentWeek.startIndex + selectedDayInWeekIndex
    : 0;
  const selectedDay = schedule?.days[selectedDayIndex];
  const todayDate = kstDate(now);
  const isToday = selectedDay?.date === todayDate;

  const bannerNotice = selectedDay?.notices?.[0];

  const nextBus = useMemo(() => {
    if (!selectedDay?.schedule || selectedDay.display !== 'schedule') return undefined;
    return getNextBus(selectedDay.schedule, isToday, currentService?.stopSequences, now);
  }, [selectedDay, isToday, currentService, now]);

  // WHY: a segment group does not remember its last direction, so the page pushed back names the service.
  const openStation: OnStationPress = (stationId, from) => {
    const params = { groupId, ...(currentService && { serviceId: currentService.serviceId }) };
    openMapPlace({ kind: 'subway_station', placeId: stationId }, from, { href: '/bus/schedule', params });
  };

  return {
    config,
    configLoading,
    screenConfig,
    infoUrl,
    handleInfoPress,
    isChips,
    currentService,
    selectedServiceIndex,
    selectService,
    activeSection,
    setActiveSection,
    routeTappedFromBoardingRef,
    schedule,
    scheduleError,
    refetchSchedule,
    refresh,
    scheduleLoad,
    now,
    currentWeek,
    selectedDayInWeekIndex,
    setSelectedDayInWeekIndex,
    selectedDay,
    isToday,
    bannerNotice,
    nextBus,
    openStation,
  };
}
