import { CaretDownIcon } from 'phosphor-react-native';
import { useT, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { Pressable, Txt, useSemanticColors, createThemedStyles } from '@skkuverse/sds';

/**
 * WHY: a button with a surface, not a caption between hairlines, which read as a divider and went unseen;
 * a surface rather than a border, since borders here already mean link and attachment rows.
 */
export function NoticeBodyDivider({ onPress }: { onPress: () => void }) {
  const styles = useStyles();
  const color = useSemanticColors();
  const { t } = useT();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('notices.viewSource')}
      bg="neutralWeak"
      style={styles.button}
    >
      <Txt typography="t5" fontWeight="semibold" color="neutral">
        {t('notices.viewSource')}
      </Txt>
      <CaretDownIcon size={13} color={color.fg.neutralSubtle} weight="bold" />
    </Pressable>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SdsSpacing.x1_5,
    // WHY: flush with the list above; 12 below plus the scroll gap of 8 is 20, the body-to-attachments rhythm.
    marginTop: 0,
    marginBottom: SdsSpacing.x3,
    paddingVertical: SdsSpacing.x3,
    borderRadius: SdsRadius.r3,
    // WHY: bg.neutralWeak through Pressable's `bg`; grey50 was almost invisible on white.
  },
}));
