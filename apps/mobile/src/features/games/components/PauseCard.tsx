import { View } from 'react-native';
import { Txt, createThemedStyles } from '@skkuverse/sds';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';

/** WHY: it sits on the game's own canvas, so the game supplies its fill and inks from its palette. */
export function PauseCard({ title, sub, ink, softInk, fill }: { title: string; sub: string; ink: string; softInk: string; fill: string }) {
  const styles = useStyles();
  return (
    <View style={[styles.card, { backgroundColor: fill }]}>
      <Txt typography="t9" fontWeight="bold" style={{ color: ink }}>
        {title}
      </Txt>
      <Txt typography="t3" style={[styles.sub, { color: softInk }]}>
        {sub}
      </Txt>
    </View>
  );
}

const useStyles = createThemedStyles(() => ({
  card: {
    borderRadius: SdsRadius.r4,
    paddingVertical: SdsSpacing.x4_5,
    paddingHorizontal: SdsSpacing.x7,
    alignItems: 'center',
  },
  sub: { marginTop: SdsSpacing.x1 },
}));
