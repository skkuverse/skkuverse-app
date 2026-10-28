import { Image, ScrollView, View } from 'react-native';
import { UserIcon } from 'phosphor-react-native';
import { Button, Dialog, TextButton, Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import { SdsSpacing, useT } from '@skkuverse/shared';
import { logSettingsAction, logSettingsContentSelect } from '@/platform/analytics';
import { DeleteAccountFeedbackSheet } from './components/DeleteAccountFeedbackSheet';
import { useAccountSettings } from './useAccountSettings';

const PHOTO_SIZE = 80;

export function AccountSettingsScreen() {
  const styles = useStyles();
  const { t } = useT();
  const {
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
  } = useAccountSettings();

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {showProfile ? (
          <>
            <View style={styles.hero}>
              <PhotoOrIcon photoURL={photoURL} />
              <View style={styles.identityBlock}>
                <Txt typography="t11" fontWeight="bold" color="neutral">
                  {displayName ?? ''}
                </Txt>
                {email ? (
                  <Txt typography="t5" color="neutralSubtle">
                    {email}
                  </Txt>
                ) : null}
              </View>
            </View>

            <View style={styles.actionSection}>
              <Button
                tone="critical"
                variant="weak"
                size="small"
                display="block"
                onPress={() => {
                  logSettingsAction({ action: 'sign_out_prompt' });
                  setShowSignOutDialog(true);
                }}
              >
                {t('auth.signOut')}
              </Button>
            </View>

            <View style={styles.deleteSection}>
              <TextButton
                typography="t3"
                variant="underline"
                color="neutralSubtle"
                disabled={isDeleting}
                onPress={() => {
                  logSettingsAction({ action: 'delete_account_prompt' });
                  setShowDeleteDialog(true);
                }}
              >
                {t('auth.deleteAccount')}
              </TextButton>
            </View>
          </>
        ) : (
          <>
            <View style={styles.hero}>
              <PhotoOrIcon photoURL={null} />
              <View style={styles.identityBlock}>
                <Txt
                  typography="t11"
                  fontWeight="bold"
                  color="neutral"
                  textAlign="center"
                >
                  {t('auth.loginCardTitle')}
                </Txt>
                <Txt typography="t5" color="neutralSubtle" textAlign="center">
                  {t('auth.loginPrompt')}
                </Txt>
              </View>
            </View>

            <View style={styles.actionSection}>
              <Button
                tone="neutral"
                size="small"
                display="block"
                onPress={() => {
                  logSettingsContentSelect({ content_type: 'signin_from_account_anon', item_id: 'login' });
                  router.push('/login');
                }}
              >
                {t('auth.googleSignIn')}
              </Button>
            </View>
          </>
        )}
      </ScrollView>

      <Dialog.Confirm
        open={showSignOutDialog}
        description={t('auth.signOutConfirm')}
        onClose={() => setShowSignOutDialog(false)}
        leftButton={
          <Button
            tone="neutral"
            variant="weak"
            size="small"
            display="block"
            onPress={() => {
              logSettingsAction({ action: 'sign_out_cancel' });
              setShowSignOutDialog(false);
            }}
          >
            {t('common.close')}
          </Button>
        }
        rightButton={
          <Button
            tone="critical"
            size="small"
            display="block"
            onPress={() => {
              logSettingsAction({ action: 'sign_out_confirm' });
              handleSignOut();
            }}
          >
            {t('auth.signOut')}
          </Button>
        }
      />

      <Dialog.Confirm
        open={showDeleteDialog}
        title={t('auth.deleteAccountConfirmTitle')}
        description={t('auth.deleteAccountConfirmDescription')}
        onClose={() => setShowDeleteDialog(false)}
        leftButton={
          <Button
            tone="neutral"
            variant="weak"
            size="small"
            display="block"
            onPress={() => {
              logSettingsAction({ action: 'delete_account_cancel' });
              setShowDeleteDialog(false);
            }}
          >
            {t('common.close')}
          </Button>
        }
        rightButton={
          <Button
            tone="critical"
            size="small"
            display="block"
            onPress={() => {
              logSettingsAction({ action: 'delete_account_confirm' });
              handleProceedToFeedback();
            }}
          >
            {t('auth.deleteAccountNext')}
          </Button>
        }
      />

      <DeleteAccountFeedbackSheet
        ref={feedbackSheetRef}
        isSubmitting={isDeleting}
        onSubmit={handleSubmitDeletion}
      />
    </View>
  );
}

function PhotoOrIcon({ photoURL }: { photoURL: string | null | undefined }) {
  const color = useSemanticColors();
  const styles = useStyles();
  if (photoURL) {
    return <Image source={{ uri: photoURL }} style={styles.photo} />;
  }
  return (
    <View style={[styles.photo, styles.photoFallback]}>
      <UserIcon size={36} color={color.fg.neutralSubtle} />
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: SdsSpacing.x12,
    paddingHorizontal: SdsSpacing.x5,
    paddingBottom: SdsSpacing.x8,
  },
  hero: {
    alignItems: 'center',
    gap: SdsSpacing.x4,
  },
  identityBlock: {
    alignItems: 'center',
    gap: SdsSpacing.x1_5,
  },
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: PHOTO_SIZE / 2,
  },
  photoFallback: {
    backgroundColor: color.bg.neutralWeak,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSection: {
    marginTop: SdsSpacing.x12,
  },
  deleteSection: {
    marginTop: SdsSpacing.x8,
    alignItems: 'center',
  },
}));
