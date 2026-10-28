import type { RefObject } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { Stack } from 'expo-router';
import { InfoIcon } from 'phosphor-react-native';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import NativeSegmentedControl from '@react-native-segmented-control/segmented-control';
import { hexToColor, useT, SdsSpacing } from '@skkuverse/shared';
import { SegmentedControl, Tab, useSemanticColors, createThemedStyles } from '@skkuverse/sds';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { TossfaceRuns } from '@/components/TossfaceRuns';
import { AdaptiveBanner } from '@/features/ads/AdaptiveBanner';
import { AdUnitIds } from '@/platform/ads';
import { RefreshFab, REFRESH_FAB_CLEARANCE } from '../components/RefreshFab';
import { InfoBanner } from './InfoBanner';
import { AiNotice } from './AiNotice';
import { DayGrid } from './DayGrid';
import { SectionCard } from './SectionCard';
import { ScheduleList } from './ScheduleList';
import { NoticeBar } from './NoticeBar';
import { SuspendedCard } from './components/SuspendedCard';
import { NoDataCard } from './components/NoDataCard';
import { NoServiceCard } from './components/NoServiceCard';
import { ErrorCard } from './components/ErrorCard';
import { ScheduleSkeleton } from './ScheduleSkeleton';
import { ServiceChips } from './ServiceChips';
import { BoardingSection } from './BoardingSection';
import type { ScheduleTone } from './schedule.types';
import { useSchedule } from './useSchedule';
import { useScheduleLanding } from './components/useScheduleLanding';

const GLASS_AVAILABLE = isLiquidGlassAvailable();

export function ScheduleScreen({
  groupId,
  serviceParam,
  source,
}: {
  groupId: string;
  serviceParam?: string;
  source?: string;
}) {
  const styles = useStyles();
  const color = useSemanticColors();
  const { t } = useT();
  const {
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
  } = useSchedule(groupId, serviceParam, source);

  const {
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
  } = useScheduleLanding({
    activeSection,
    setActiveSection,
    routeTappedFromBoardingRef,
    currentService,
    schedule,
    selectedDay,
    isToday,
    nextBus,
  });

  const refreshFab =
    refresh && currentService && config ? (
      <RefreshFab
        color={hexToColor(config.card.themeColor, color.bg.dataBrand)}
        onPress={refresh}
        analytics={{ content_type: 'schedule_refresh', item_id: currentService.serviceId }}
      />
    ) : null;

  if (configLoading || !config) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: '' }} />
        <ScheduleSkeleton />
      </View>
    );
  }

  const tone: ScheduleTone = sectioned ? 'neutral' : 'colored';

  const stackScreen = (
    <Stack.Screen
      options={{
        title: config.label,
        headerRight: infoUrl
          ? () => (
              <HeaderIconButton onPress={handleInfoPress}>
                <InfoIcon size={22} color={color.fg.neutral} />
              </HeaderIconButton>
            )
          : undefined,
      }}
    />
  );

  const selector =
    screenConfig && screenConfig.services.length > 1 ? (
      isChips ? (
        <ServiceChips
          services={screenConfig.services}
          selectedId={currentService?.serviceId}
          onSelect={selectService}
        />
      ) : Platform.OS === 'ios' && GLASS_AVAILABLE ? (
        <NativeSegmentedControl
          values={screenConfig.services.map((s) => s.label)}
          selectedIndex={selectedServiceIndex}
          onChange={(e) => {
            const id = screenConfig.services[e.nativeEvent.selectedSegmentIndex]?.serviceId;
            if (id) selectService(id);
          }}
          style={styles.nativeSegmented}
        />
      ) : (
        <SegmentedControl value={currentService?.serviceId ?? ''} onValueChange={selectService}>
          {screenConfig.services.map((service) => (
            <SegmentedControl.Item key={service.serviceId} value={service.serviceId} typography="t3" style={busToggleItemStyle}>
              <TossfaceRuns text={service.label} />
            </SegmentedControl.Item>
          ))}
        </SegmentedControl>
      )
    ) : null;

  const dayGrid =
    schedule?.status === 'active' && currentWeek ? (
      <DayGrid
        days={currentWeek.days}
        selectedIndex={selectedDayInWeekIndex}
        onSelect={setSelectedDayInWeekIndex}
      />
    ) : null;

  // WHY: an announced closure (e.g. festival days) says where to go instead, so a no-service day shows its
  // notices too; the server opens the page on that day.
  const dayNotices =
    schedule?.status === 'active' &&
    (selectedDay?.display === 'schedule' ||
      (selectedDay?.display === 'noService' && selectedDay.notices.length > 0)) ? (
      <>
        {bannerNotice && (
          <View style={styles.bannerWrapper}>
            {bannerNotice.style === 'ai' ? (
              <AiNotice text={bannerNotice.text} />
            ) : (
              <InfoBanner text={bannerNotice.text} tone={tone} />
            )}
          </View>
        )}

        {selectedDay.notices.slice(1).map((notice, i) =>
          notice.style === 'ai' ? (
            <View key={i} style={styles.noticeWrapper}>
              <AiNotice text={notice.text} />
            </View>
          ) : (
            <NoticeBar key={i} notice={notice} tone={tone} />
          ),
        )}

      </>
    ) : null;

  const timetable =
    scheduleError && !schedule ? (
      <ErrorCard onRetry={scheduleLoad.onRetry} />
    ) : !schedule ? (
      <ScheduleSkeleton />
    ) : schedule.status === 'suspended' ? (
      <SuspendedCard resumeDate={schedule.resumeDate} message={schedule.message} />
    ) : schedule.status === 'noData' ? (
      <NoDataCard />
    ) : schedule.status === 'active' ? (
      selectedDay?.display === 'noService' ? (
        <NoServiceCard label={selectedDay.label} />
      ) : selectedDay?.display === 'schedule' ? (
        <ScheduleList
          entries={selectedDay.schedule}
          routeBadges={screenConfig?.routeBadges ?? []}
          isToday={isToday}
          now={now}
          nextEntryIndex={nextBus?.index}
          showFooter={!sectioned}
          sequences={currentService?.stopSequences}
          attachmentSources={
            screenConfig && currentService
              ? { catalog: screenConfig.stops, serviceId: currentService.serviceId, date: selectedDay.date }
              : undefined
          }
          layout={sectioned ? 'sectioned' : 'v1'}
          onStationPress={openStation}
          nextRowRef={sectioned ? nextRowRef : undefined}
          onNextRowLayout={sectioned ? () => land('nextRow') : undefined}
        />
      ) : null
    ) : (
      <ErrorCard onRetry={() => refetchSchedule()} />
    );

  // QUIRK(react-native): a sticky header stops where the next one reaches its bottom edge, so the zero-height
  // header after the timetable pushes the pinned day off. Sticky indices count direct children: none conditional.
  if (sectioned && currentService && screenConfig) {
    return (
      <View style={styles.container}>
        {stackScreen}
        <SectionCard style={styles.headerSection}>
          {selector}
          <Tab value={activeSection} onChange={jumpTo} size="small">
            <Tab.Item value="timetable">{t('schedule.section.timetable')}</Tab.Item>
            <Tab.Item value="boarding">{t('schedule.section.boarding')}</Tab.Item>
          </Tab>
        </SectionCard>

        <ScrollView
          ref={scrollRef}
          // QUIRK(react-native): the d.ts types this as a RefObject that is never null, which no useRef is.
          innerViewRef={innerViewRef as RefObject<View>}
          style={styles.scrollView}
          contentContainerStyle={[styles.sectionedContent, refreshFab && styles.fabClearance]}
          stickyHeaderIndices={SECTIONED_STICKY_HEADERS}
          onScroll={onSectionScroll}
          onScrollBeginDrag={cancelLanding}
          scrollEventThrottle={32}
        >
          <View
            style={styles.pinned}
            onLayout={(e) => (pinnedHeightRef.current = e.nativeEvent.layout.height)}
          >
            {dayNotices}
            {dayGrid ? <View style={styles.sectionDayGrid}>{dayGrid}</View> : null}
          </View>

          <SectionCard style={styles.section}>{timetable}</SectionCard>

          <View />

          <View
            style={styles.boardingWrapper}
            onLayout={(e) => {
              boardingYRef.current = e.nativeEvent.layout.y;
              land('layout');
            }}
          >
            <SectionCard style={[styles.section, styles.boardingSection]}>
              <BoardingSection
                service={currentService}
                stops={screenConfig.stops}
                routeBadges={screenConfig.routeBadges}
                entries={selectedDay?.display === 'schedule' ? selectedDay.schedule : undefined}
                onStationPress={openStation}
              />
            </SectionCard>
          </View>
        </ScrollView>

        {refreshFab}

        <AdaptiveBanner unitId={AdUnitIds.busBanner} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {stackScreen}

      <SectionCard style={styles.headerSection}>
        {selector}
        {dayGrid}
      </SectionCard>

      {dayNotices ? <SectionCard style={styles.timetableSection}>{dayNotices}</SectionCard> : null}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, refreshFab && styles.fabClearance]}
        bounces={false}
      >
        <SectionCard style={styles.timetableSection}>{timetable}</SectionCard>
      </ScrollView>

      {refreshFab}

      <AdaptiveBanner unitId={AdUnitIds.busBanner} />
    </View>
  );
}





const SECTIONED_STICKY_HEADERS = [0, 2];

// EVIDENCE: x1 keeps the fallback track near the 32pt native control it stands in for on iOS 26.
const busToggleItemStyle = { paddingVertical: SdsSpacing.x1 } as const;

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.neutralMuted,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    gap: SdsSpacing.x2,
    paddingBottom: SdsSpacing.x5,
  },
  fabClearance: {
    paddingBottom: REFRESH_FAB_CLEARANCE + SdsSpacing.x5,
  },
  sectionedContent: {
    paddingBottom: SdsSpacing.x5,
  },
  pinned: {
    backgroundColor: color.bg.layerDefault,
  },
  boardingWrapper: {
    marginTop: SdsSpacing.x2,
  },
  headerSection: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingTop: SdsSpacing.x1,
    paddingBottom: SdsSpacing.x1,
    gap: SdsSpacing.x1,
  },
  bannerWrapper: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingTop: SdsSpacing.x2,
  },
  noticeWrapper: {
    marginHorizontal: SdsSpacing.gutter,
    marginTop: SdsSpacing.x1_5,
  },
  timetableSection: {
  },
  nativeSegmented: {
    alignSelf: 'stretch',
  },
  section: {
    paddingBottom: SdsSpacing.x7,
  },
  boardingSection: {
    paddingTop: SdsSpacing.x6,
  },
  sectionDayGrid: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingTop: SdsSpacing.x2,
  },
}));
