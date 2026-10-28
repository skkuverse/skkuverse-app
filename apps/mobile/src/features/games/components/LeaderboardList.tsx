import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LayoutAnimationConfig, LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { Txt } from '@skkuverse/sds';
import { SdsSpacing } from '@skkuverse/shared';
import type { BoardLine } from '../leaderboard.rules';
import { LeaderboardRow } from './LeaderboardRow';

// QUIRK(react-native-reanimated): with Reanimated 4's spring defaults (mass 4, stiffness 900) a small raw damping
// bounces rows past their slots.
const MOVE = LinearTransition.springify().dampingRatio(0.9).reduceMotion(ReduceMotion.System);
const ENTER = FadeIn.duration(250).reduceMotion(ReduceMotion.System);
const EXIT = FadeOut.duration(150).reduceMotion(ReduceMotion.System);

/** WHY: plain views, not a FlatList: a handful of rows, and layout transitions on plain views are the reliable path. */
export function LeaderboardList({ lines, format }: { lines: readonly BoardLine[]; format(score: number): string }) {
  return (
    <LayoutAnimationConfig skipEntering skipExiting>
      <View>
        {lines.map((line) => (
          <Animated.View key={line.key} layout={MOVE} entering={ENTER} exiting={EXIT}>
            {line.kind === 'gap' ? (
              <Txt typography="t5" color="placeholder" style={styles.gap}>
                ⋯
              </Txt>
            ) : (
              <LeaderboardRow line={line} format={format} />
            )}
          </Animated.View>
        ))}
      </View>
    </LayoutAnimationConfig>
  );
}

const styles = StyleSheet.create({
  gap: { textAlign: 'center', paddingVertical: SdsSpacing.x0_5 },
});
