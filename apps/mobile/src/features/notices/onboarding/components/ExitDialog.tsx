import { Button, Dialog } from '@skkuverse/sds';
import { useT } from '@skkuverse/shared';

interface Props {
  open: boolean;
  onContinue: () => void;
  onLeave: () => void;
}

export function ExitDialog({ open, onContinue, onLeave }: Props) {
  const { t } = useT();
  return (
    <Dialog.Confirm
      open={open}
      title={t('onboarding.exitTitle')}
      description={t('onboarding.exitDescription')}
      leftButton={
        <Button tone="brand" size="small" display="block" onPress={onContinue}>
          {t('onboarding.exitContinue')}
        </Button>
      }
      rightButton={
        <Button variant="weak" tone="neutral" size="small" display="block" onPress={onLeave}>
          {t('onboarding.exitLeave')}
        </Button>
      }
      onClose={onContinue}
    />
  );
}
