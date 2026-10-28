import { useMemo, useRef, type RefObject } from 'react';
import { View } from 'react-native';
import { CaretRightIcon } from 'phosphor-react-native';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { Pressable, Tossface, Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import { usePromoCard } from './usePromoCard';
import { usePromoImpressions } from './usePromoImpressions';
import type { PromoSlot } from './promo.types';

interface PromoCardProps {
  slot: PromoSlot;
  viewportRef: RefObject<View | null>;
  bottomInset: number;
}

export function PromoCard({ slot, viewportRef, bottomInset }: PromoCardProps) {
  const styles = useStyles();
  const color = useSemanticColors();
  const { card, params, onPress } = usePromoCard(slot);
  const cardRef = useRef<View>(null);
  const entries = useMemo(() => (params ? [{ params, ref: cardRef }] : []), [params]);
  usePromoImpressions(entries, { ref: viewportRef, top: 0, bottomInset });

  if (!card) return null;

  return (
    <View ref={cardRef} collapsable={false} style={styles.slot}>
      <Pressable bg="brandWeak" style={styles.card} onPress={onPress}>
        <Tossface size={28}>{card.emoji}</Tossface>
        <View style={styles.text}>
          <Txt typography="t2" fontWeight="bold" color="brand">
            {card.caption}
          </Txt>
          <Txt typography="t4" fontWeight="bold" color="brandContrast">
            {card.title}
          </Txt>
          <Txt typography="t3" color="brandContrast">
            {card.subtitle}
          </Txt>
        </View>
        <CaretRightIcon size={18} color={color.fg.brand} />
      </Pressable>
    </View>
  );
}

const useStyles = createThemedStyles(() => ({
  slot: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingTop: SdsSpacing.x3,
  },
  card: {
    borderRadius: SdsRadius.r3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x3,
    paddingHorizontal: SdsSpacing.x4,
    paddingVertical: SdsSpacing.x3_5,
  },
  text: {
    flex: 1,
    gap: SdsSpacing.x0_5,
  },
}));
