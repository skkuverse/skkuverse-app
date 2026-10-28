import { StyleSheet, View } from 'react-native';
import { Txt } from '@skkuverse/sds';
import { SdsSpacing } from '@skkuverse/shared';

interface Props {
  eyebrow?: string;
  title: string;
  sub: string;
  best?: string;
  ink: string;
  softInk: string;
  eyebrowInk?: string;
}

/** WHY: where it sits is the overlay's choice, since it must land on the part of the page left clear for it. */
export function StageTitle({ eyebrow, title, sub, best, ink, softInk, eyebrowInk }: Props) {
  return (
    <View style={styles.block}>
      {eyebrow && (
        <Txt typography="t3" fontWeight="semibold" style={{ color: eyebrowInk ?? softInk }}>
          {eyebrow}
        </Txt>
      )}
      <Txt typography="t13" fontWeight="bold" style={[styles.title, { color: ink }]}>
        {title}
      </Txt>
      <Txt typography="t5" style={[styles.sub, { color: softInk }]}>
        {sub}
      </Txt>
      {best && (
        <Txt typography="t3" fontWeight="semibold" style={[styles.best, { color: ink }]}>
          {best}
        </Txt>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { alignItems: 'center' },
  title: { marginVertical: SdsSpacing.x1_5, textAlign: 'center' },
  sub: { textAlign: 'center' },
  best: { marginTop: SdsSpacing.x3 },
});
