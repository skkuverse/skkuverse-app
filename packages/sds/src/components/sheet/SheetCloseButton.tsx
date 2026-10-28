/**
 * QUIRK(gorhom-bottom-sheet): `useBottomSheetModal()` reads context the modal provides, so it is called here, inside the modal,
 * not in the component that renders the modal. `dismiss()` with no key closes the top-most modal, which is this one while pressed.
 */

import { useBottomSheetModal } from '@gorhom/bottom-sheet';
import { XIcon } from 'phosphor-react-native';
import { SheetIconButton } from './SheetIconButton';

export function SheetCloseButton({ label, onPress }: { label: string; onPress?: () => void }) {
  const { dismiss } = useBottomSheetModal();
  return (
    <SheetIconButton
      icon={XIcon}
      label={label}
      // WHY: an inline sheet has no modal to dismiss, so its body says what closing means.
      onPress={onPress ?? (() => dismiss())}
    />
  );
}
