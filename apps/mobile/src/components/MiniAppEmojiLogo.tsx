import { View } from 'react-native';
import { Tossface, createThemedStyles } from '@skkuverse/sds';

/**
 * WHY: the remote-image logo's footprint, so callers swap the two without touching layout. The 0.72 and
 * 0.95 ratios are unchecked on a device; a glyph that sits off-centre means adjusting those two.
 */
export function MiniAppEmojiLogo({
  emoji,
  size,
}: {
  emoji: string;
  size: number;
}) {
  const styles = useStyles();
  return (
    <View
      style={[
        styles.box,
        { width: size, height: size, borderRadius: size * 0.22 },
      ]}
      accessible={false}
    >
      <Tossface size={Math.round(size * 0.72)} style={[styles.emoji, { lineHeight: Math.round(size * 0.95) }]}>
        {emoji}
      </Tossface>
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  box: {
    backgroundColor: color.bg.neutralWeak,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emoji: {
    textAlign: 'center',
    includeFontPadding: false,
  },
}));
