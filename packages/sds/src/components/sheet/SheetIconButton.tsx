import { StyleSheet } from 'react-native';
import type { Icon } from 'phosphor-react-native';
import { SdsRadius } from '@skkuverse/shared';
import { useSemanticColors } from '../../core/theme';
import { Pressable } from '../pressable';

export function SheetIconButton({ icon: IconGlyph, label, onPress }: { icon: Icon; label: string; onPress: () => void }) {
  const color = useSemanticColors();
  return (
    <Pressable bg="neutralWeak" onPress={onPress} hitSlop={8} accessibilityLabel={label} style={styles.button}>
      <IconGlyph size={18} color={color.fg.neutralMuted} weight="bold" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 32,
    height: 32,
    borderRadius: SdsRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
