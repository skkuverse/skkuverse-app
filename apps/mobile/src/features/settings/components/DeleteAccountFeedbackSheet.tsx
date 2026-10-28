import { forwardRef, useCallback, useRef, useState } from 'react';
import {
  Keyboard,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Button, Checkbox, Sheet, TextField, Txt, useSheetBottomInset, type SheetRef } from '@skkuverse/sds';
import { SdsSpacing, useT } from '@skkuverse/shared';
import type { DeleteAccountFeedback } from '@/features/auth/auth.types';

const REASONS = [
  'not_used',
  'too_many_notifs',
  'no_value',
  'bugs',
  'other',
] as const;
type Reason = (typeof REASONS)[number];

const OTHER_TEXT_MAX = 500;

type Props = {
  isSubmitting: boolean;
  onSubmit: (feedback?: DeleteAccountFeedback) => void;
};

// WHY: skip-and-delete runs the same destructive flow, and the Cloud Function drops
// empty feedback, so `onSubmit(undefined)` is the no-feedback path; no uid is stored.
export const DeleteAccountFeedbackSheet = forwardRef<SheetRef, Props>(
  function DeleteAccountFeedbackSheet({ isSubmitting, onSubmit }, parentRef) {
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

    const [selected, setSelected] = useState<Set<Reason>>(new Set());
    const [otherText, setOtherText] = useState('');

    const toggle = (reason: Reason) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(reason)) next.delete(reason);
        else next.add(reason);
        return next;
      });
    };

    const otherSelected = selected.has('other');

    const buildFeedback = (): DeleteAccountFeedback | undefined => {
      const reasons = Array.from(selected);
      const trimmed = otherText.trim().slice(0, OTHER_TEXT_MAX);
      if (reasons.length === 0 && trimmed.length === 0) return undefined;
      return {
        reasons,
        ...(trimmed.length > 0 ? { otherText: trimmed } : {}),
      };
    };

    return (
      <Sheet
        ref={setRefs}
        position={{ kind: 'stuck', detent: 'large' }}
        androidKeyboardInputMode="adjustResize"
      >
        {/* eslint-disable-next-line sds/no-rn-pressable -- a tap-away that only dismisses the keyboard, not a control, so it gives no feedback; it adds no view around the sheet's scroll view */}
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <Sheet.ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: CONTENT_BOTTOM_PAD + bottomInset }]}
            keyboardShouldPersistTaps="handled"
          >
            <Txt
              typography="t11"
              fontWeight="bold"
              color="neutral"
              style={styles.title}
            >
              {t('auth.deleteAccountFeedbackTitle')}
            </Txt>
            <Txt
              typography="t5"
              color="neutralSubtle"
              style={styles.subtitle}
            >
              {t('auth.deleteAccountFeedbackSubtitle')}
            </Txt>

            <View style={styles.list}>
              {REASONS.map((reason) => (
                <Checkbox.Line
                  key={reason}
                  checked={selected.has(reason)}
                  onCheckedChange={() => toggle(reason)}
                  style={styles.row}
                >
                  <Txt typography="t7" color="neutral">
                    {t(`auth.deleteAccountReason.${reason}` as never) as string}
                  </Txt>
                </Checkbox.Line>
              ))}
            </View>

            {otherSelected && (
              <View style={styles.otherInputWrap}>
                <TextField
                  variant="box"
                  label={t('auth.deleteAccountReason.otherPlaceholder')}
                  value={otherText}
                  onChangeText={(text) =>
                    setOtherText(text.slice(0, OTHER_TEXT_MAX))
                  }
                  multiline
                  maxLength={OTHER_TEXT_MAX}
                />
              </View>
            )}

            <View style={styles.actions}>
              <Button
                tone="neutral"
                variant="weak"
                size="small"
                display="block"
                disabled={isSubmitting}
                onPress={() => onSubmit(undefined)}
              >
                {t('auth.deleteAccountSkip')}
              </Button>
              <View style={{ height: 8 }} />
              <Button
                tone="critical"
                size="small"
                display="block"
                loading={isSubmitting}
                onPress={() => onSubmit(buildFeedback())}
              >
                {t('auth.deleteAccountAction')}
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
    marginBottom: SdsSpacing.x2,
  },
  subtitle: {
    marginBottom: SdsSpacing.x6,
  },
  list: {
    gap: SdsSpacing.x2,
  },
  row: {
    paddingVertical: SdsSpacing.x1,
  },
  otherInputWrap: {
    marginTop: SdsSpacing.x3,
  },
  actions: {
    marginTop: SdsSpacing.x6,
  },
});
