import { StyleSheet, View } from 'react-native';
import { CaretRightIcon } from 'phosphor-react-native';
import { Pressable, Txt, useSemanticColors } from '@skkuverse/sds';
import { useT, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { HallOfFameTitle } from './HallOfFameTitle';

export function BoardHeader({ typography, onViewAll }: { typography: 't9' | 't7'; onViewAll(): void }) {
  const color = useSemanticColors();
  const { t } = useT();
  return (
    <View style={styles.row}>
      <View style={styles.title}>
        <HallOfFameTitle typography={typography} />
      </View>
      <Pressable
        onPress={onViewAll}
        bg="transparent"
        style={styles.viewAll}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`${t('game.hallOfFame')} ${t('common.viewAll')}`}
      >
        <Txt typography="t3" color="neutralSubtle">
          {t('common.viewAll')}
        </Txt>
        <CaretRightIcon size={12} color={color.fg.placeholder} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SdsSpacing.x1 },
  title: { flex: 1, marginRight: SdsSpacing.x3 },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: SdsSpacing.x0_5, flexShrink: 0, borderRadius: SdsRadius.r1 },
});
