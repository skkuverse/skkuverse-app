import { StyleSheet, View } from 'react-native';

import { FloatingEmoji, type EmojiSpec } from '@/components/FloatingEmoji';

// WHY: the four emoji are the four things the page's body copy names. Percentages place each
// emoji's top-left corner, so larger ones sit lower than their visual centre suggests.
const EMOJIS: readonly EmojiSpec[] = [
  { ch: '\u{1F4E2}', left: '26%', top: '36%', size: 80, rot: -12, delay: 0, float: 16 },
  { ch: '\u{1F68C}', left: '62%', top: '6%', size: 58, rot: 16, delay: 800, float: 13 },
  { ch: '\u{1F5FA}', left: '8%', top: '4%', size: 46, rot: -22, delay: 1400, float: 11 },
  { ch: '\u{23F0}', left: '64%', top: '64%', size: 52, rot: 10, delay: 2000, float: 14 },
];

export function IntroEmojiField() {
  return (
    <View style={styles.field}>
      {EMOJIS.map((spec) => (
        <FloatingEmoji key={spec.ch} spec={spec} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    width: '100%',
    // WHY: square, not the figure's full height: the emoji sit at percents of this box, and a tall box pulls
    // them into four unrelated corners instead of one loose group.
    aspectRatio: 1,
    maxHeight: 360,
    alignSelf: 'center',
    position: 'relative',
  },
});
