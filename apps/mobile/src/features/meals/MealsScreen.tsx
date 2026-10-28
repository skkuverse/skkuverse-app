import { useRef } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { Stack } from 'expo-router';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import NativeSegmentedControl from '@react-native-segmented-control/segmented-control';
import { ForkKnifeIcon } from 'phosphor-react-native';
import { CAMPUSES, SdsSpacing, useT, type Campus, type TranslationKey } from '@skkuverse/shared';
import {
  ResultSection,
  SegmentedControl,
  Skeleton,
  Tab,
  Txt,
  createThemedStyles,
  useSemanticColors,
} from '@skkuverse/sds';
import { CafeteriaChips } from './components/CafeteriaChips';
import { DayStrip } from './components/DayStrip';
import { MealSection } from './components/MealSection';
import { useMealSectionScroll } from './components/useMealSectionScroll';
import type { MealsCode } from './meals.types';
import { useMeals } from './useMeals';

const GLASS_AVAILABLE = isLiquidGlassAvailable();

const MEAL_LABEL_KEYS: Record<MealsCode, TranslationKey> = {
  B: 'meals.code.B',
  L: 'meals.code.L',
  D: 'meals.code.D',
  S: 'meals.code.S',
  R: 'meals.code.R',
};

const toggleItemStyle = { paddingVertical: SdsSpacing.x1 } as const;

export function MealsScreen() {
  const styles = useStyles();
  const color = useSemanticColors();
  const { t } = useT();
  const vm = useMeals();
  const meals = vm.cafeteria?.meals ?? [];
  const codes = meals.map((meal) => meal.code);
  const landingKey = `${vm.campus}:${vm.date}:${vm.cafeteria?.id ?? ''}`;
  const scrollRef = useRef<ScrollView>(null);
  const scroll = useMealSectionScroll(scrollRef, codes, landingKey, vm.landingCode);

  const campusLabels = CAMPUSES.map((c) => t(c === 'hssc' ? 'campus.hssc' : 'campus.nsc'));
  const campusSelector =
    Platform.OS === 'ios' && GLASS_AVAILABLE ? (
      <NativeSegmentedControl
        values={campusLabels}
        selectedIndex={CAMPUSES.indexOf(vm.campus)}
        onChange={(e) => {
          const next = CAMPUSES[e.nativeEvent.selectedSegmentIndex];
          if (next) vm.onCampusChange(next);
        }}
        style={styles.nativeSegmented}
      />
    ) : (
      <SegmentedControl value={vm.campus} onValueChange={(value) => vm.onCampusChange(value as Campus)}>
        {CAMPUSES.map((c, i) => (
          <SegmentedControl.Item key={c} value={c} typography="t3" style={toggleItemStyle}>
            {campusLabels[i]}
          </SegmentedControl.Item>
        ))}
      </SegmentedControl>
    );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('meals.title') }} />
      <View style={styles.header}>
        {campusSelector}
        <View style={styles.dayStrip}>
          <DayStrip weeks={vm.weeks} initialWeek={vm.initialWeek} selectedDate={vm.date} onSelect={vm.onDateChange} />
        </View>
        {vm.cafeterias.length > 0 && (
          <View style={styles.chips}>
            <CafeteriaChips cafeterias={vm.cafeterias} selectedId={vm.cafeteria?.id} onSelect={vm.onCafeteriaChange} />
          </View>
        )}
        {vm.tabs.length > 0 && (
          <Tab
            value={scroll.activeCode ?? ''}
            onChange={(value) => {
              const code = value as MealsCode;
              // WHY: a tap only; the scroll moves the tab through `show`, which never reaches here.
              if (code !== scroll.activeCode) vm.onMealTabSelect(code);
              scroll.onTabChange(code);
            }}
            size="small"
            style={styles.tabs}
          >
            {vm.tabs.map((tab) => (
              <Tab.Item key={tab.code} value={tab.code} disabled={tab.closed !== undefined}>
                {t(MEAL_LABEL_KEYS[tab.code])}
              </Tab.Item>
            ))}
          </Tab>
        )}
      </View>

      {vm.status === 'ready' && vm.cafeteria ? (
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          onScroll={(e) => scroll.onScroll(e)}
          onScrollBeginDrag={() => scroll.onScrollBeginDrag()}
          scrollEventThrottle={32}
        >
          {vm.cafeteria.subtitle ? (
            <Txt typography="t4" color="neutralSubtle" style={styles.subtitle}>
              {vm.cafeteria.subtitle}
            </Txt>
          ) : null}
          {meals.map((meal) => (
            <View key={`${landingKey}:${meal.code}`} style={styles.card} onLayout={(e) => scroll.onSectionLayout(meal.code, e)}>
              <MealSection
                title={t(MEAL_LABEL_KEYS[meal.code])}
                meal={meal}
                onExpandFixed={() => vm.onFixedMenuExpand(meal.code)}
              />
            </View>
          ))}
        </ScrollView>
      ) : vm.status === 'ready' ? (
        <ResultSection
          asset={<ForkKnifeIcon size={SdsSpacing.x10} color={color.fg.neutralSubtle} />}
          title={t('meals.noMenuDay')}
        />
      ) : vm.status === 'error' ? (
        <ResultSection
          asset={<ForkKnifeIcon size={SdsSpacing.x10} color={color.fg.neutralSubtle} />}
          title={t('meals.menuLoadFailed')}
          primaryActionProps={{ children: t('common.retry'), onPress: vm.onRetry }}
        />
      ) : (
        <Skeleton.Animate>
          <View style={styles.skeleton}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.skeletonBlock}>
                <Skeleton width={120} height={20} />
                <Skeleton width={220} height={16} />
                <Skeleton width={180} height={16} />
              </View>
            ))}
          </View>
        </Skeleton.Animate>
      )}
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.neutralMuted,
  },
  header: {
    backgroundColor: color.bg.layerDefault,
    paddingHorizontal: SdsSpacing.gutter,
    paddingTop: SdsSpacing.x3,
  },
  dayStrip: {
    marginTop: SdsSpacing.x5,
  },
  chips: {
    marginTop: SdsSpacing.x5,
  },
  tabs: {
    marginTop: SdsSpacing.x3,
  },
  nativeSegmented: {
    alignSelf: 'stretch',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    gap: SdsSpacing.x2,
    paddingBottom: SdsSpacing.x10,
  },
  subtitle: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingTop: SdsSpacing.x3,
  },
  card: {
    backgroundColor: color.bg.layerDefault,
  },
  skeleton: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingTop: SdsSpacing.x4,
    gap: SdsSpacing.x8,
  },
  skeletonBlock: {
    gap: SdsSpacing.x2,
  },
}));
