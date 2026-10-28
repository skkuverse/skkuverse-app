import { forwardRef, useCallback, useRef } from 'react';
import { View } from 'react-native';
import { Sheet, useSheetBottomInset, type SheetRef, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import { BellRingingIcon } from 'phosphor-react-native';
import { Button, Txt } from '@skkuverse/sds';
import { SdsSpacing, useT, SdsRadius } from '@skkuverse/shared';
import { useEnableNotificationsSheet } from './useEnableNotificationsSheet';

/**
 * WHY: a grant also turns the master switch on, since tapping enable is the explicit ask. Dismissal
 * marks the session flag through `onDismiss`, so a close after a grant and a backdrop skip both count.
 */
export const EnableNotificationsSheet = forwardRef<SheetRef>(
  function EnableNotificationsSheet(_, parentRef) {
    const color = useSemanticColors();
    const styles = useStyles();
    const { t } = useT();
    const bottomInset = useSheetBottomInset();

    const sheetRef = useRef<SheetRef>(null);
    const setRefs = useCallback(
      (node: SheetRef | null) => {
        sheetRef.current = node;
        if (typeof parentRef === 'function') parentRef(node);
        else if (parentRef) parentRef.current = node;
      },
      [parentRef],
    );

    const { handleEnable, setDismissed } = useEnableNotificationsSheet(sheetRef);

    return (
      <Sheet
        ref={setRefs}
        position={{ kind: 'stuck', detent: 'small' }}
        onDismiss={() => setDismissed(true)}
      >
        <Sheet.View style={[styles.content, { paddingBottom: CONTENT_BOTTOM_PAD + bottomInset }]}>
          <View style={styles.iconCircle}>
            <BellRingingIcon size={40} color={color.fg.positive} weight="fill" />
          </View>
          <Txt
            typography="t11"
            fontWeight="bold"
            color="neutral"
            style={styles.title}
          >
            {t('notifications.enableSheetTitle')}
          </Txt>
          <Txt
            typography="t5"
            color="neutralSubtle"
            style={styles.description}
          >
            {t('notifications.enableSheetDescription')}
          </Txt>
          <View style={styles.ctaWrap}>
            <Button
              tone="brand"
              size="large"
              display="block"
              onPress={handleEnable}
            >
              {t('notifications.enableSheetCta')}
            </Button>
          </View>
        </Sheet.View>
      </Sheet>
    );
  },
);

const CONTENT_BOTTOM_PAD = 40;

const useStyles = createThemedStyles(({ color }) => ({
  content: {
    paddingHorizontal: SdsSpacing.x6,
    paddingTop: SdsSpacing.x5,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: SdsRadius.full,
    backgroundColor: color.bg.positiveWeak,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SdsSpacing.x5,
  },
  title: {
    marginBottom: SdsSpacing.x2,
  },
  description: {
    marginBottom: SdsSpacing.x6,
  },
  ctaWrap: {
    marginTop: 'auto',
  },
}));
