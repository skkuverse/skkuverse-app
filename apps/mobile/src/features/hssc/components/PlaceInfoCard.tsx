import { View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { CaretLeftIcon, CaretRightIcon, XIcon } from 'phosphor-react-native';
import { SdsSpacing, SdsRadius, SdsShadows } from '@skkuverse/shared';
import { Pressable, Txt, useSemanticColors, createThemedStyles } from '@skkuverse/sds';
import type { LineEntry } from '../available-lines.constants';

interface PlaceInfoCardProps {
  info: LineEntry;
  onPreviousPress: () => void;
  onNextPress: () => void;
  onDismiss: () => void;
}

export function PlaceInfoCard({
  info,
  onPreviousPress,
  onNextPress,
  onDismiss,
}: PlaceInfoCardProps) {
  const styles = useStyles();
  const color = useSemanticColors();
  return (
    <Animated.View
      entering={FadeInDown.duration(250)}
      exiting={FadeOutDown.duration(200)}
      style={styles.container}
      accessibilityRole="alert"
      accessibilityLabel={`${info.placename}, ${info.buildingname}`}
    >
      <View
        style={[
          styles.accentBar,
          { backgroundColor: `#${info.leftColor}` },
        ]}
      />

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Txt typography="t7" fontWeight="bold" color="neutral">
              {info.placename}
            </Txt>
            <Txt typography="t3" fontWeight="regular" color="neutralSubtle">
              {info.buildingname}
            </Txt>
          </View>
          <Pressable
            onPress={onDismiss}
            hitSlop={8}
            bg="transparent"
            style={styles.closeButton}
            accessibilityLabel="닫기"
          >
            <XIcon size={18} color={color.fg.placeholder} />
          </Pressable>
        </View>

        {info.placeinfo && (
          <Txt
            typography="t3"
            fontWeight="regular"
            color="neutralMuted"
            style={styles.infoText}
          >
            {info.placeinfo}
          </Txt>
        )}

        {info.time && (
          <Txt
            typography="t3"
            fontWeight="regular"
            color="informative"
            style={styles.infoText}
          >
            {info.time}
          </Txt>
        )}

        {(info.previousplace || info.afterplace) && (
          <View style={styles.navRow}>
            <Pressable
              onPress={onPreviousPress}
              disabled={!info.previousplace}
              bg="transparent"
              style={[
                styles.navButton,
                !info.previousplace && styles.navButtonDisabled,
              ]}
              accessibilityLabel={
                info.previousplace
                  ? `이전: ${info.previousplace}`
                  : '이전 층 없음'
              }
            >
              <CaretLeftIcon
                size={16}
                color={
                  info.previousplace ? `#${info.leftColor}` : color.fg.disabled
                }
              />
              <Txt
                typography="t3"
                fontWeight="medium"
                color={info.previousplace ? 'neutralMuted' : 'disabled'}
                numberOfLines={1}
              >
                {info.previousplace ?? ''}
              </Txt>
            </Pressable>

            <View style={styles.navDivider} />

            <Pressable
              onPress={onNextPress}
              disabled={!info.afterplace}
              bg="transparent"
              style={[
                styles.navButton,
                styles.navButtonRight,
                !info.afterplace && styles.navButtonDisabled,
              ]}
              accessibilityLabel={
                info.afterplace
                  ? `다음: ${info.afterplace}`
                  : '다음 층 없음'
              }
            >
              <Txt
                typography="t3"
                fontWeight="medium"
                color={info.afterplace ? 'neutralMuted' : 'disabled'}
                numberOfLines={1}
              >
                {info.afterplace ?? ''}
              </Txt>
              <CaretRightIcon
                size={16}
                color={
                  info.afterplace ? `#${info.rightColor}` : color.fg.disabled
                }
              />
            </Pressable>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    flexDirection: 'row',
    backgroundColor: color.bg.layerDefault,
    borderRadius: SdsRadius.r4,
    ...SdsShadows.level3.legacy,
    overflow: 'hidden',
  },
  accentBar: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: SdsSpacing.x3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    gap: SdsSpacing.x0_5,
  },
  closeButton: {
    padding: SdsSpacing.x1,
    marginLeft: SdsSpacing.x2,
    borderRadius: SdsRadius.full,
  },
  infoText: {
    marginTop: SdsSpacing.x1,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SdsSpacing.x2,
    paddingTop: SdsSpacing.x2,
    borderTopWidth: 1,
    borderTopColor: color.stroke.neutralSubtle,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x1,
    borderRadius: SdsRadius.r2,
  },
  navButtonRight: {
    justifyContent: 'flex-end',
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navDivider: {
    width: 1,
    height: 20,
    backgroundColor: color.stroke.neutralMuted,
    marginHorizontal: SdsSpacing.x1,
  },
}));
