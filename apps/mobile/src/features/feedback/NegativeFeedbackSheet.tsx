import { forwardRef, useCallback, useRef, useState } from 'react';
import {
  Keyboard,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Button, Sheet, TextField, Txt, useSheetBottomInset, type SheetRef } from '@skkuverse/sds';
import { SdsSpacing, useT } from '@skkuverse/shared';

const FEEDBACK_TEXT_MAX = 1500;

type Props = {
  isSubmitting: boolean;
  onSubmit: (text: string) => void;
  onDismiss: () => void;
};

export const NegativeFeedbackSheet = forwardRef<SheetRef, Props>(
  function NegativeFeedbackSheet({ isSubmitting, onSubmit, onDismiss }, parentRef) {
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
    const [text, setText] = useState('');

    // WHY: an empty submit is allowed, since choosing thumbs-down is already the signal.
    const handleSubmit = () => {
      const trimmed = text.trim().slice(0, FEEDBACK_TEXT_MAX);
      onSubmit(trimmed);
    };

    return (
      <Sheet
        ref={setRefs}
        position={{ kind: 'stuck', detent: 'medium' }}
        // QUIRK(android): keyboard-controller runs on iOS only, so the sheet relies on adjustResize to shrink around the keyboard.
        androidKeyboardInputMode="adjustResize"
        onDismiss={() => {
          setText('');
          onDismiss();
        }}
      >
        {/* eslint-disable-next-line sds/no-rn-pressable -- a tap-away that only dismisses the keyboard, not a control, so it gives no feedback; it adds no view around the sheet's scroll view */}
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <Sheet.ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: CONTENT_BOTTOM_PAD + bottomInset }]}
            keyboardShouldPersistTaps="handled"
          >
            <Txt
              typography="t10"
              fontWeight="bold"
              color="neutral"
              style={styles.title}
            >
              {t('feedback.reviewPrompt.negativePlaceholder')}
            </Txt>
            <View style={styles.inputWrap}>
              <TextField
                variant="box"
                label={t('feedback.reviewPrompt.negativePlaceholder')}
                value={text}
                onChangeText={(next) => setText(next.slice(0, FEEDBACK_TEXT_MAX))}
                multiline
                maxLength={FEEDBACK_TEXT_MAX}
              />
            </View>
            <View style={styles.actions}>
              <Button
                tone="brand"
                size="large"
                display="block"
                loading={isSubmitting}
                onPress={handleSubmit}
              >
                {t('feedback.reviewPrompt.negativeSubmit')}
              </Button>
            </View>
          </Sheet.ScrollView>
        </TouchableWithoutFeedback>
      </Sheet>
    );
  },
);

const CONTENT_BOTTOM_PAD = 40;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SdsSpacing.x6,
    paddingTop: SdsSpacing.x5,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  title: {
    marginBottom: SdsSpacing.x5,
  },
  inputWrap: {
    marginBottom: SdsSpacing.x6,
  },
  actions: {
    marginTop: 'auto',
  },
});
