import { DotsThreeIcon } from 'phosphor-react-native';
import { GlassIconButton, useSemanticColors } from '@skkuverse/sds';
import { FLOATING_BTN } from './floating-button.constants';

export function FloatingMoreButton({ onPress }: { onPress: () => void }) {
  const color = useSemanticColors();
  return (
    <GlassIconButton
      icon={<DotsThreeIcon size={22} color={color.fg.neutral} weight="bold" />}
      label="더보기"
      onPress={onPress}
      size={FLOATING_BTN}
    />
  );
}
