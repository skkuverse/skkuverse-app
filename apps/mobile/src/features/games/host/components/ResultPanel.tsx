import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@skkuverse/sds';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { ResultCard } from './ResultCard';

interface Props {
  score: ReactNode;
  board?: ReactNode;
  offer?: ReactNode;
  onNext(): void;
  topInset: number;
  scrim: string;
}

export function ResultPanel({ score, board, offer, onNext, topInset, scrim }: Props) {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View
        entering={FadeIn.duration(250).reduceMotion(ReduceMotion.System)}
        style={[StyleSheet.absoluteFill, { backgroundColor: scrim }]}
        pointerEvents="none"
      />
      <ScrollView
        contentContainerStyle={[styles.cards, { paddingTop: topInset, paddingBottom: 96 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <ResultCard order={0}>{score}</ResultCard>
        {board ? (
          <ResultCard order={1}>
            {board}
            {offer && <View style={styles.offer}>{offer}</View>}
          </ResultCard>
        ) : (
          offer && <ResultCard order={1}>{offer}</ResultCard>
        )}
      </ScrollView>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
        <Button tone="neutral" size="large" display="block" onPress={onNext}>
          {t('game.next')}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cards: { paddingHorizontal: SdsSpacing.x4, gap: SdsSpacing.x3 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: SdsSpacing.x4 },
  offer: { marginTop: SdsSpacing.x4 },
});
