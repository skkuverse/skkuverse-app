import { View } from 'react-native';
import { CheckIcon } from 'phosphor-react-native';
import { Pressable, Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';

interface Props {
  name: string;
  location: string;
  selected: boolean;
  onPress: () => void;
}

export function CampusCard({ name, location, selected, onPress }: Props) {
  const styles = useStyles();
  const color = useSemanticColors();
  const brandStyles = useBrandStyles();

  return (
    // WHY: the fill and outline show the selection, so a press only shrinks the card (PRESS-06).
    <Pressable
      bg={selected ? 'positiveWeak' : 'transparent'}
      feedback="scale"
      style={[styles.card, selected && brandStyles.cardSelected]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${name}, ${location}`}
    >
      <View>
        <Txt
          typography="t7"
          fontWeight="bold"
          color={selected ? 'brandContrast' : 'neutral'}
        >
          {name}
        </Txt>
        <Txt typography="t3" color="placeholder" style={styles.location}>
          {location}
        </Txt>
      </View>
      {selected && (
        <View style={[styles.checkCircle, brandStyles.checkCircle]}>
          <CheckIcon size={12} color={color.fg.onBrandSolid} />
        </View>
      )}
    </Pressable>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: color.stroke.neutralMuted,
    // eslint-disable-next-line sds/no-radius-literal -- the campus card's drawn corner, midway between r4 and r5; kept as drawn until a screenshot-reviewed batch picks one (2pt either way)
    borderRadius: 18,
    // eslint-disable-next-line sds/no-spacing-literal -- the campus card's drawn inset, midway between x5 and x6; kept as drawn until a screenshot-reviewed batch picks one (2pt either way)
    padding: 22,
    marginBottom: SdsSpacing.x3,
  },
  location: {
    marginTop: SdsSpacing.x1,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: SdsRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

const useBrandStyles = createThemedStyles(({ color }) => ({
  cardSelected: {
    borderColor: color.stroke.brandSolid,
  },
  checkCircle: {
    backgroundColor: color.bg.brandSolid,
  },
}));
