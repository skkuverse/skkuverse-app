import React, { useCallback, useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { SdsDuration, SdsRadius, SdsSpacing, type FgColorName } from '@skkuverse/shared';
import { CaretRightIcon, CaretDownIcon } from 'phosphor-react-native';
import { createThemedStyles, useSemanticColors } from '../../core/theme';
import { Pressable } from '../pressable';
import { RowPressable } from '../pressable/RowPressable';
import { Txt } from '../txt';

export interface AccordionSection<T = unknown> {
  title: string;
  subtitle?: string;
  badge?: string;
  items: T[];
}

export interface AccordionListProps<T = unknown> {
  sections: AccordionSection<T>[];
  expandedIndex: number | null;
  onToggle: (index: number | null) => void;
  renderItem: (item: T, index: number, highlighted: boolean) => ReactNode;
  keyExtractor: (item: T) => string;
  highlightKey?: string | null;
  maxVisible?: number;
  showAllMap?: Record<number, boolean>;
  onShowAll?: (sectionIndex: number) => void;
  showMoreLabel?: (remaining: number) => string;
  renderRight?: (section: AccordionSection<T>, index: number) => ReactNode;
  accentColor?: FgColorName;
}

function AccordionBadge({ text, expanded }: { text: string; expanded: boolean }) {
  const color = useSemanticColors();
  const collapsedFill = color.bg.neutralWeak;
  const expandedFill = color.bg.neutralInverted;
  const progress = useSharedValue(expanded ? 1 : 0);
  useEffect(() => {
    progress.set(withTiming(expanded ? 1 : 0, { duration: SdsDuration.normal }));
  }, [expanded, progress]);

  const animatedBg = useAnimatedStyle(() => ({
    backgroundColor: progress.get() > 0.5 ? expandedFill : collapsedFill,
  }));

  return (
    <Animated.View style={[staticStyles.badge, animatedBg]}>
      <Txt
        typography="t3"
        fontWeight="bold"
        color={expanded ? 'neutralInverted' : 'neutralSubtle'}
      >
        {text}
      </Txt>
    </Animated.View>
  );
}

export interface AccordionTileProps<T = unknown> {
  section: AccordionSection<T>;
  index: number;
  isFirst: boolean;
  expanded: boolean;
  onToggle: () => void;
  renderItem: (item: T, index: number, highlighted: boolean) => ReactNode;
  keyExtractor: (item: T) => string;
  highlightKey?: string | null;
  maxVisible: number;
  showAll?: boolean;
  onShowAll?: () => void;
  showMoreLabel: (remaining: number) => string;
  renderRight?: ReactNode;
  accentColor?: FgColorName;
}

function AccordionTile<T>({
  section,
  isFirst,
  expanded,
  onToggle,
  renderItem,
  keyExtractor,
  highlightKey,
  maxVisible,
  showAll = false,
  onShowAll,
  showMoreLabel,
  renderRight,
  accentColor,
}: AccordionTileProps<T>) {
  const styles = useStyles();
  const color = useSemanticColors();

  const { items } = section;
  const badgeText = section.badge ?? section.title.charAt(0);
  const subtitle = section.subtitle;
  const visibleItems = showAll ? items : items.slice(0, maxVisible);
  const remaining = items.length - maxVisible;

  return (
    <View>
      {!isFirst && (
        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
        </View>
      )}

      <RowPressable onPress={onToggle}>
        <View style={styles.tileContent}>
          <AccordionBadge text={badgeText} expanded={expanded} />
          <View style={styles.tileTexts}>
            <Txt typography="t7" fontWeight="regular">
              {section.title}
            </Txt>
            {subtitle != null && (
              <Txt typography="t3" fontWeight="regular" color="neutralSubtle">
                {subtitle}
              </Txt>
            )}
          </View>
          {renderRight != null && (
            <View style={styles.tileRight}>{renderRight}</View>
          )}
          {expanded ? (
            <CaretDownIcon size={18} color={color.fg.placeholder} />
          ) : (
            <CaretRightIcon size={18} color={color.fg.placeholder} />
          )}
        </View>
      </RowPressable>

      {expanded && items.length > 0 && (
        <Animated.View
          entering={FadeIn.duration(SdsDuration.fast)}
          exiting={FadeOut.duration(SdsDuration.instant)}
          style={styles.itemListContainer}
        >
          {visibleItems.map((item, i) => {
            const key = keyExtractor(item);
            const highlighted = highlightKey != null && key === highlightKey;
            return (
              <React.Fragment key={key}>
                {renderItem(item, i, highlighted)}
              </React.Fragment>
            );
          })}

          {!showAll && remaining > 0 && (
            <Pressable onPress={onShowAll} style={styles.showMoreButton}>
              <Txt typography="t2" fontWeight="semiBold" color={accentColor ?? 'informative'}>
                {showMoreLabel(remaining)}
              </Txt>
            </Pressable>
          )}
        </Animated.View>
      )}
    </View>
  );
}

function defaultShowMoreLabel(remaining: number) {
  return `+ ${remaining}개 더보기`;
}

function AccordionListInner<T>({
  sections,
  expandedIndex,
  onToggle,
  renderItem,
  keyExtractor,
  highlightKey,
  maxVisible = 5,
  showAllMap = {},
  onShowAll,
  showMoreLabel = defaultShowMoreLabel,
  renderRight,
  accentColor,
}: AccordionListProps<T>) {
  const handleToggle = useCallback(
    (index: number) => {
      onToggle(expandedIndex === index ? null : index);
    },
    [expandedIndex, onToggle],
  );

  if (sections.length === 0) return null;

  return (
    <View>
      {sections.map((section, i) => (
        <AccordionTile<T>
          key={`section-${i}`}
          section={section}
          index={i}
          isFirst={i === 0}
          expanded={expandedIndex === i}
          onToggle={() => handleToggle(i)}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          highlightKey={highlightKey}
          maxVisible={maxVisible}
          showAll={showAllMap[i] ?? false}
          onShowAll={onShowAll ? () => onShowAll(i) : undefined}
          showMoreLabel={showMoreLabel}
          renderRight={renderRight?.(section, i)}
          accentColor={accentColor}
        />
      ))}
    </View>
  );
}

export const AccordionList = Object.assign(AccordionListInner, {
  Tile: AccordionTile,
});

const BADGE_SIZE = 40;
const TITLE_INSET = SdsSpacing.x5 + BADGE_SIZE + SdsSpacing.x4;

const staticStyles = StyleSheet.create({
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: SdsRadius.r2_5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const useStyles = createThemedStyles(({ color }) => ({
  tileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SdsSpacing.x5,
    paddingVertical: SdsSpacing.x4,
  },
  tileTexts: {
    flex: 1,
    marginLeft: SdsSpacing.x4,
    gap: SdsSpacing.x0_5,
  },
  tileRight: {
    marginLeft: SdsSpacing.x4,
    marginRight: SdsSpacing.x2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dividerContainer: {
    paddingLeft: TITLE_INSET,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.bg.neutralMuted,
  },
  itemListContainer: {
    paddingLeft: TITLE_INSET,
    paddingRight: SdsSpacing.x5,
    paddingBottom: SdsSpacing.x3,
  },
  showMoreButton: {
    paddingTop: SdsSpacing.x2_5,
  },
}));
