import React, { useState } from 'react';
import { View } from 'react-native';
import { InfoIcon } from 'phosphor-react-native';
import {
  Button,
  Dialog,
  FixedBottomCTA,
  Sheet,
  SheetCloseButton,
  SheetHandle,
  SheetHeader,
  SheetIconButton,
  Toast,
  Txt,
  createThemedStyles,
  useSheetBottomInset,
} from '@skkuverse/sds';
import { SdsSpacing } from '@skkuverse/shared';
import { Group } from './Group';
import { Row } from './Row';
import { useStyles as usePartStyles } from './Section';

type ToastKind = 'check' | 'error' | 'warning' | 'info' | 'action' | 'top';
const TOASTS: readonly ToastKind[] = ['check', 'error', 'warning', 'info', 'action', 'top'];

export function OverlayStates() {
  const styles = useStyles();
  const parts = usePartStyles();
  const bottomInset = useSheetBottomInset();
  const [dialog, setDialog] = useState<'alert' | 'confirm' | null>(null);
  const [toast, setToast] = useState<ToastKind | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const close = () => setDialog(null);

  return (
    <>
      <Group label="Dialog — tap the dimmer: the alert closes, the confirm stays">
        <Row>
          <Button size="small" tone="neutral" variant="weak" onPress={() => setDialog('alert')}>
            Open alert
          </Button>
          <Button size="small" tone="neutral" variant="weak" onPress={() => setDialog('confirm')}>
            Open confirm
          </Button>
        </Row>
      </Group>

      <Group label="Toast — icons, an action (5 s), the top position; hold one to pause it">
        <Row>
          {TOASTS.map((kind) => (
            <Button key={kind} size="xsmall" tone="neutral" variant="weak" onPress={() => setToast(kind)}>
              {kind}
            </Button>
          ))}
        </Row>
      </Group>

      <Group label="Sheet — fit, with SheetHeader, SheetHandle, SheetIconButton and SheetCloseButton">
        <Row>
          <Button size="small" tone="neutral" variant="weak" onPress={() => setSheetOpen(true)}>
            Open sheet
          </Button>
        </Row>
      </Group>

      <Group label="FixedBottomCTA — at the bottom of its column">
        <View style={[parts.frame, styles.ctaFrame]}>
          <View style={styles.ctaBody}>
            <Txt typography="t4" color="neutralSubtle">
              {'The column’s content'}
            </Txt>
          </View>
          <FixedBottomCTA>
            <Button display="block" onPress={() => setToast('check')}>
              Complete
            </Button>
          </FixedBottomCTA>
        </View>
      </Group>

      <Dialog.Alert
        open={dialog === 'alert'}
        title="Alert"
        description="A tap on the dimmer closes it, like its button."
        buttonText="OK"
        onClose={close}
      />
      <Dialog.Confirm
        open={dialog === 'confirm'}
        title="Confirm"
        description="Only its buttons close it."
        leftButton={
          <Button size="small" display="block" tone="neutral" variant="weak" onPress={close}>
            Cancel
          </Button>
        }
        rightButton={
          <Button size="small" display="block" tone="critical" onPress={close}>
            Delete
          </Button>
        }
        onClose={close}
      />

      <Toast
        open={toast !== null}
        text={toast === 'action' ? 'Moved to the archive' : `A ${toast ?? ''} toast`}
        position={toast === 'top' ? 'top' : 'bottom'}
        icon={
          toast === 'action' || toast === 'top' ? (
            <Toast.Icon type="check" />
          ) : toast !== null ? (
            <Toast.Icon type={toast} />
          ) : undefined
        }
        button={toast === 'action' ? <Toast.Button text="Undo" onPress={() => setToast(null)} /> : undefined}
        onClose={() => setToast(null)}
      />

      <Sheet open={sheetOpen} position={{ kind: 'fit' }} backdrop onDismiss={() => setSheetOpen(false)}>
        <Sheet.View style={[styles.sheet, { paddingBottom: SdsSpacing.x6 + bottomInset }]}>
          <SheetHandle />
          <SheetHeader title="Sheet title" closeLabel="Close" />
          <Txt typography="t5" color="neutralMuted">
            A fit sheet: as tall as its content.
          </Txt>
          <Row>
            <SheetIconButton icon={InfoIcon} label="Info" onPress={() => {}} />
            <SheetCloseButton label="Close" />
          </Row>
        </Sheet.View>
      </Sheet>
    </>
  );
}

const useStyles = createThemedStyles(() => ({
  ctaFrame: {
    height: 200,
  },
  ctaBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    gap: SdsSpacing.x3,
    paddingHorizontal: SdsSpacing.gutter,
  },
}));
