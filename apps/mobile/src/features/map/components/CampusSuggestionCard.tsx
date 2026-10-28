/**
 * QUIRK(ios): UIKit skips a glass effect installed under low opacity, so a `GlassView` in an `entering` animation
 * can render nothing; this card mounts plainly. The message states, the button acts; a caret reads as navigation.
 * With location refused, the offer has no dismiss: hiding it would leave the locate button inert.
 */

import { View } from 'react-native';
import { XIcon } from 'phosphor-react-native';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { GlassSurface, Pressable, createThemedStyles, useSemanticColors, Txt } from '@skkuverse/sds';
import { MAP_CONTROL_HEIGHT } from '../map-layout.constants';

interface CampusSuggestionCardProps {
  message: string;
  /** WHY: short, since it shares a 40pt row with the locate button. */
  actionLabel: string;
  onAccept: () => void;
  onDismiss?: () => void;
  dismissLabel?: string;
}

export function CampusSuggestionCard({
  message,
  actionLabel,
  onAccept,
  onDismiss,
  dismissLabel,
}: CampusSuggestionCardProps) {
  const color = useSemanticColors();
  const styles = useStyles();
  const brandStyles = useBrandStyles();

  return (
    <GlassSurface interactive style={styles.surface}>
      <View style={styles.row}>
        <Txt typography="t4" fontWeight="semibold" style={styles.message} numberOfLines={1}>
          {message}
        </Txt>
        <Pressable
          onPress={onAccept}
          accessibilityRole="button"
          accessibilityLabel={`${message}. ${actionLabel}`}
          bg="brandSolid"
          style={styles.action}
        >
          <Txt typography="t3" fontWeight="bold" style={brandStyles.actionLabel} numberOfLines={1}>
            {actionLabel}
          </Txt>
        </Pressable>
        {onDismiss && (
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel={dismissLabel}
            bg="transparent"
            style={styles.close}
          >
            <XIcon size={14} color={color.fg.neutralSubtle} weight="bold" />
          </Pressable>
        )}
      </View>
    </GlassSurface>
  );
}

const ACTION_HEIGHT = 28;

const useStyles = createThemedStyles(({ color }) => ({
  surface: {
    flex: 1,
    height: MAP_CONTROL_HEIGHT,
    borderRadius: MAP_CONTROL_HEIGHT / 2,
    overflow: 'hidden',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x2,
    paddingLeft: SdsSpacing.x4,
    // WHY: smaller than the left inset, since the close mark and button carry their own tap padding.
    paddingRight: SdsSpacing.x1_5,
  },
  message: {
    flex: 1,
    color: color.fg.neutral,
  },
  action: {
    height: ACTION_HEIGHT,
    borderRadius: ACTION_HEIGHT / 2,
    paddingHorizontal: SdsSpacing.x3_5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: {
    width: 32,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SdsRadius.full,
  },
}));

const useBrandStyles = createThemedStyles(({ color }) => ({
  actionLabel: {
    color: color.fg.onBrandSolid,
  },
}));
