import type { ReactNode, RefObject } from 'react';
import { Dialog, Toast, type SheetRef } from '@skkuverse/sds';
import { useT } from '@skkuverse/shared';
import { ReviewPromptSheet } from './ReviewPromptSheet';
import { NegativeFeedbackSheet } from './NegativeFeedbackSheet';

export interface ReviewPromptHostProps {
  helpfulSheetRef: RefObject<SheetRef | null>;
  feedbackSheetRef: RefObject<SheetRef | null>;
  icon: ReactNode;
  title: string;
  isFeedbackSubmitting: boolean;
  showThanks: boolean;
  toastText: string | null;
  onPositive: () => void;
  onNegative: () => void;
  onDismiss: () => void;
  onFeedbackSubmit: (text: string) => void;
  onFeedbackDismiss: () => void;
  closeThanks: () => void;
  clearToast: () => void;
}

export function ReviewPromptHost({
  helpfulSheetRef,
  feedbackSheetRef,
  icon,
  title,
  isFeedbackSubmitting,
  showThanks,
  toastText,
  onPositive,
  onNegative,
  onDismiss,
  onFeedbackSubmit,
  onFeedbackDismiss,
  closeThanks,
  clearToast,
}: ReviewPromptHostProps) {
  const { t } = useT();
  return (
    <>
      <ReviewPromptSheet
        ref={helpfulSheetRef}
        icon={icon}
        title={title}
        onPositive={onPositive}
        onNegative={onNegative}
        onDismiss={onDismiss}
      />
      <NegativeFeedbackSheet
        ref={feedbackSheetRef}
        isSubmitting={isFeedbackSubmitting}
        onSubmit={onFeedbackSubmit}
        onDismiss={onFeedbackDismiss}
      />
      <Dialog.Alert
        open={showThanks}
        title={t('feedback.reviewPrompt.thanks')}
        buttonText={t('common.close')}
        onClose={closeThanks}
      />
      <Toast
        open={toastText !== null}
        text={toastText ?? ''}
        icon={<Toast.Icon type="check" />}
        onClose={clearToast}
      />
    </>
  );
}
