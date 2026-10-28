import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView, View } from 'react-native';
import { logBusContentSelect } from '@/platform/analytics';
import type { ScheduleSection } from '../schedule.types';
import type { useSchedule } from '../useSchedule';

type Landing = 'nextRun' | 'top' | 'boarding';

const PREVIOUS_RUN_PEEK = 40;

const LANDING_FALLBACK_MS = 250;

type Schedule = ReturnType<typeof useSchedule>;

interface ScheduleLandingInputs {
  activeSection: ScheduleSection;
  setActiveSection: (section: ScheduleSection) => void;
  routeTappedFromBoardingRef: RefObject<boolean>;
  currentService: Schedule['currentService'];
  schedule: Schedule['schedule'];
  selectedDay: Schedule['selectedDay'];
  isToday: boolean;
  nextBus: Schedule['nextBus'];
}

export function useScheduleLanding({
  activeSection,
  setActiveSection,
  routeTappedFromBoardingRef,
  currentService,
  schedule,
  selectedDay,
  isToday,
  nextBus,
}: ScheduleLandingInputs) {
  // WHY: the scroll a tap starts is not read back for a moment, so the tab does not flick through the section between.
  const scrollRef = useRef<ScrollView>(null);
  const boardingYRef = useRef(0);
  const jumpingUntil = useRef(0);

  const onSectionScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (Date.now() < jumpingUntil.current) return;
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    const atEnd = contentOffset.y + layoutMeasurement.height >= contentSize.height - 2;
    const next = atEnd || contentOffset.y >= boardingYRef.current - 1 ? 'boarding' : 'timetable';
    if (next !== activeSection) setActiveSection(next);
  };

  const jumpTo = (value: string) => {
    const section: ScheduleSection = value === 'boarding' ? 'boarding' : 'timetable';
    if (section !== activeSection && currentService) {
      logBusContentSelect({ content_type: 'schedule_section', item_id: `${currentService.serviceId}:${section}` });
    }
    jumpingUntil.current = Date.now() + 600;
    setActiveSection(section);
    scrollRef.current?.scrollTo({ y: section === 'boarding' ? boardingYRef.current : 0, animated: true });
  };

  // QUIRK(react-native): Fabric sends no layout event for an unchanged frame (a weekday's timetable can match the
  // day before), hence the fallback timer. Only the route and the day move the scroll, never the minute ticker.
  const sectioned = !!currentService?.stopSequences;
  const innerViewRef = useRef<View>(null);
  const nextRowRef = useRef<View>(null);
  const pinnedHeightRef = useRef(0);
  const landing = useRef<Landing | null>(null);
  const landingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const landedOnce = useRef(false);

  const cancelLanding = () => {
    landing.current = null;
    clearTimeout(landingTimer.current);
  };

  const scrollToLanding = (y: number, section: ScheduleSection) => {
    cancelLanding();
    jumpingUntil.current = Date.now() + 600;
    setActiveSection(section);
    scrollRef.current?.scrollTo({ y, animated: landedOnce.current });
    landedOnce.current = true;
  };

  const land = (from: 'nextRow' | 'layout') => {
    const target = landing.current;
    if (!target || (from === 'nextRow' && target !== 'nextRun')) return;
    if (target === 'boarding') {
      scrollToLanding(boardingYRef.current, 'boarding');
      return;
    }
    const row = nextRowRef.current;
    const inner = innerViewRef.current;
    if (target === 'nextRun' && row && inner) {
      row.measureLayout(inner, (_x, y) =>
        scrollToLanding(Math.max(0, y - pinnedHeightRef.current - PREVIOUS_RUN_PEEK), 'timetable'),
      );
    } else {
      scrollToLanding(0, 'timetable');
    }
  };

  const landingKey =
    sectioned && currentService && schedule
      ? `${currentService.serviceId}|${selectedDay?.date ?? ''}`
      : undefined;
  useLayoutEffect(() => {
    landing.current = null;
    if (!landingKey) return;
    landing.current = routeTappedFromBoardingRef.current
      ? 'boarding'
      : isToday && nextBus
        ? 'nextRun'
        : 'top';
    routeTappedFromBoardingRef.current = false;
    const timer = setTimeout(
      () => {
        land('layout');
        cancelLanding();
      },
      landing.current === 'top' ? 0 : LANDING_FALLBACK_MS,
    );
    landingTimer.current = timer;
    return () => clearTimeout(timer);
  }, [landingKey]); // eslint-disable-line react-hooks/exhaustive-deps -- per route and day, never per minute tick

  return {
    sectioned,
    scrollRef,
    innerViewRef,
    nextRowRef,
    pinnedHeightRef,
    boardingYRef,
    onSectionScroll,
    jumpTo,
    cancelLanding,
    land,
  };
}
