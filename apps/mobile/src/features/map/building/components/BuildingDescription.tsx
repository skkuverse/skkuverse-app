import { useState, useCallback } from 'react';
import { View } from 'react-native';
import { SdsSpacing, useT, SdsRadius } from '@skkuverse/shared';
import { Pressable, Txt, createThemedStyles } from '@skkuverse/sds';
import { logCampusContentSelect } from '@/platform/analytics';

const CLAMPED_LINES = 3;

interface BuildingDescriptionProps {
  description: string;
}

export function BuildingDescription({ description }: BuildingDescriptionProps) {
  const styles = useStyles();
  const { t } = useT();
  // WHY: `needsMore` is null until the hidden full-length copy reports its line count, which also keeps
  // that copy mounted: one state for "measured?" and "overflows?", so the render reads no ref.
  const [expanded, setExpanded] = useState(false);
  const [needsMore, setNeedsMore] = useState<boolean | null>(null);

  // WHY: re-measured while rendering, not in an effect, so no frame shows the old text's toggle (react.dev
  // "adjusting state when a prop changes"); new text keeps the expanded state.
  const [measuredText, setMeasuredText] = useState(description);
  if (measuredText !== description) {
    setMeasuredText(description);
    setNeedsMore(null);
  }

  const handleTextLayout = useCallback(
    (e: { nativeEvent: { lines: unknown[] } }) => {
      // WHY: the first measurement wins, even if a second layout lands before the measuring copy unmounts.
      const overflows = e.nativeEvent.lines.length > CLAMPED_LINES;
      setNeedsMore((prev) => prev ?? overflows);
    },
    [],
  );

  const toggle = (next: boolean) => {
    logCampusContentSelect({ content_type: 'building_desc_expand', item_id: next ? 'expand' : 'collapse' });
    setExpanded(next);
  };

  return (
    <View style={styles.descriptionContainer}>
      {expanded ? (
        <>
          <Txt
            typography="t5"
            fontWeight="regular"
            color="neutralMuted"
          >
            {description}
          </Txt>
          <DescriptionToggle label={t('building.collapse')} onPress={() => toggle(false)} />
        </>
      ) : (
        <View>
          {/* WHY: no numberOfLines, so this hidden copy reports the full line count. */}
          {needsMore === null && (
            <Txt
              typography="t5"
              fontWeight="regular"
              onTextLayout={handleTextLayout}
              style={styles.hiddenMeasure}
            >
              {description}
            </Txt>
          )}
          <Txt
            typography="t5"
            fontWeight="regular"
            color="neutralMuted"
            numberOfLines={CLAMPED_LINES}
          >
            {description}
          </Txt>
          {needsMore === true && (
            // WHY: below the text, not over its last line; an overlay would need an opaque patch, which shows on glass.
            <DescriptionToggle label={t('building.showMore')} onPress={() => toggle(true)} />
          )}
        </View>
      )}
    </View>
  );
}

function DescriptionToggle({ label, onPress }: { label: string; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} bg="transparent" style={styles.descToggle}>
      <Txt
        typography="t3"
        fontWeight="semiBold"
        color="brand"
      >
        {label}
      </Txt>
    </Pressable>
  );
}

const useStyles = createThemedStyles(() => ({
  descriptionContainer: {
    paddingHorizontal: SdsSpacing.x6,
  },
  descToggle: {
    marginTop: SdsSpacing.x2,
    borderRadius: SdsRadius.r1,
  },
  hiddenMeasure: {
    position: 'absolute',
    opacity: 0,
    left: 0,
    right: 0,
  },
}));
