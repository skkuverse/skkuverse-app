import { type ReactNode, forwardRef, useCallback, useRef } from 'react';
import { View } from 'react-native';
import { Button, Sheet, Txt, useSheetBottomInset, type SheetRef, createThemedStyles } from '@skkuverse/sds';
import { SdsSpacing, useT, SdsRadius } from '@skkuverse/shared';

// WHY: no analytics here; the parent owns funnel logging so a dismiss stays distinguishable from an explicit choice.
type Props = {
  icon: ReactNode;
  title: string;
  onPositive: () => void;
  onNegative: () => void;
  onDismiss: () => void;
};

export const ReviewPromptSheet = forwardRef<SheetRef, Props>(
  function ReviewPromptSheet({ icon, title, onPositive, onNegative, onDismiss }, parentRef) {
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

    const handlePositive = () => {
      sheetRef.current?.dismiss?.();
      onPositive();
    };

    const handleNegative = () => {
      sheetRef.current?.dismiss?.();
      onNegative();
    };

    return (
      <Sheet
        ref={setRefs}
        position={{ kind: 'fit' }}
        onDismiss={onDismiss}
      >
        <Sheet.View style={[styles.content, { paddingBottom: CONTENT_BOTTOM_PAD + bottomInset }]}>
          <View style={styles.iconCircle}>
            {icon}
          </View>
          <Txt
            typography="t11"
            fontWeight="bold"
            color="neutral"
            style={styles.title}
          >
            {title}
          </Txt>
          <View style={styles.actions}>
            <View style={styles.actionItem}>
              <Button
                tone="neutral"
                variant="weak"
                size="large"
                display="block"
                onPress={handleNegative}
              >
                {t('feedback.reviewPrompt.negativeCta')}
              </Button>
            </View>
            <View style={styles.actionItem}>
              <Button
                tone="brand"
                size="large"
                display="block"
                onPress={handlePositive}
              >
                {t('feedback.reviewPrompt.positiveCta')}
              </Button>
            </View>
          </View>
        </Sheet.View>
      </Sheet>
    );
  },
);

const CONTENT_BOTTOM_PAD = 32;

const useStyles = createThemedStyles(({ color }) => ({
  content: {
    paddingHorizontal: SdsSpacing.x6,
    paddingTop: SdsSpacing.x5,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: SdsRadius.full,
    backgroundColor: color.bg.brandWeak,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SdsSpacing.x3,
  },
  title: {
    textAlign: 'center',
    marginBottom: SdsSpacing.x6,
  },
  actions: {
    width: '100%',
    flexDirection: 'row',
    gap: SdsSpacing.x2,
  },
  actionItem: {
    flex: 1,
  },
}));
