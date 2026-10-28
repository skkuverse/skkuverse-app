import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { type SheetRef } from '@skkuverse/sds';
import { useAuthStore, useT } from '@skkuverse/shared';
import { signOutFromGoogle, deleteAccount } from '@/features/auth/auth.service';
import type { DeleteAccountFeedback } from '@/features/auth/auth.types';

export function useAccountSettings() {
  const router = useRouter();
  const { t } = useT();

  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const isSigningOut = useAuthStore((s) => s.isSigningOut);
  const photoURL = useAuthStore((s) => s.photoURL);
  const displayName = useAuthStore((s) => s.displayName);
  const email = useAuthStore((s) => s.email);

  const showProfile = !isAnonymous || isSigningOut;
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const feedbackSheetRef = useRef<SheetRef>(null);

  const handleSignOut = async () => {
    setShowSignOutDialog(false);
    await signOutFromGoogle();
  };

  const handleProceedToFeedback = useCallback(() => {
    setShowDeleteDialog(false);
    // WHY: present must run after the dialog unmounts, which `open` false does synchronously; one frame suffices.
    requestAnimationFrame(() => {
      feedbackSheetRef.current?.present?.();
    });
  }, []);

  const handleSubmitDeletion = useCallback(
    async (feedback?: DeleteAccountFeedback) => {
      setIsDeleting(true);
      try {
        await deleteAccount(feedback);
        feedbackSheetRef.current?.dismiss?.();
        // WHY: the notices onboarding gate renders because the anonymous re-sign-in set
        // isAnonymous and resetUserScopedState() cleared onboardingCompleted.
        router.replace('/(tabs)/notices');
      } catch {
        Alert.alert(
          t('auth.deleteAccountErrorTitle'),
          t('auth.deleteAccountError'),
        );
      } finally {
        setIsDeleting(false);
      }
    },
    [router, t],
  );

  return {
    router,
    photoURL,
    displayName,
    email,
    showProfile,
    showSignOutDialog,
    setShowSignOutDialog,
    showDeleteDialog,
    setShowDeleteDialog,
    isDeleting,
    feedbackSheetRef,
    handleSignOut,
    handleProceedToFeedback,
    handleSubmitDeletion,
  };
}
