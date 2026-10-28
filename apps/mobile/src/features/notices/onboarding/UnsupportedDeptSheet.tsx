import { Button, Dialog } from '@skkuverse/sds';
import { useT } from '@skkuverse/shared';
import { hasBundledExcludeReasonCopy } from '../picker.rules';
import type { TabSource } from '../notices.types';

interface Props {
  source: TabSource | null;
  umbrella: TabSource | null;
  onAccept: (umbrella: TabSource) => void;
  onDismiss: () => void;
}

/**
 * WHY: with no umbrella there is no alternative to offer, so the sheet only explains; with no reason copy
 * anywhere (server text, then bundled keys) it stays closed.
 */
export function UnsupportedDeptSheet({ source, umbrella, onAccept, onDismiss }: Props) {
  const { t, tpl } = useT();
  const serverCopy = source?.excludeReasonText ?? null;
  const rawKey = source?.excludeReason ?? null;
  const bundledKey =
    serverCopy === null && hasBundledExcludeReasonCopy(rawKey) ? rawKey : null;
  const reasonCopy =
    serverCopy ?? (bundledKey ? t(`onboarding.unsupportedDept.reason.${bundledKey}`) : '');
  const open = source !== null && reasonCopy !== '';
  const description = umbrella
    ? `${reasonCopy}\n${tpl('onboarding.unsupportedDept.alternative', umbrella.name)}`
    : reasonCopy;

  return (
    <Dialog.Confirm
      open={open}
      title={t('onboarding.unsupportedDept.title')}
      description={description}
      leftButton={
        umbrella ? (
          <Button
            tone="brand"
            size="small"
            display="block"
            onPress={() => onAccept(umbrella)}
          >
            {t('onboarding.unsupportedDept.acceptCta')}
          </Button>
        ) : (
          <Button
            variant="weak"
            tone="neutral"
            size="small"
            display="block"
            onPress={onDismiss}
          >
            {t('onboarding.unsupportedDept.dismissCta')}
          </Button>
        )
      }
      rightButton={
        umbrella ? (
          <Button
            variant="weak"
            tone="neutral"
            size="small"
            display="block"
            onPress={onDismiss}
          >
            {t('onboarding.unsupportedDept.dismissCta')}
          </Button>
        ) : undefined
      }
      onClose={onDismiss}
    />
  );
}
