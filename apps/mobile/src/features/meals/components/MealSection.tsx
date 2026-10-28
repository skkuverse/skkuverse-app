import { useState } from 'react';
import { View } from 'react-native';
import { SdsSpacing, useT } from '@skkuverse/shared';
import { Badge, TextButton, Txt, createThemedStyles } from '@skkuverse/sds';
import { toWon } from '../meals.rules';
import type { MealsMenuItem, MealsScreenCorner, MealsScreenMeal } from '../meals.types';

function ItemLine({ item }: { item: MealsMenuItem }) {
  const styles = useStyles();
  const { tpl } = useT();
  const sides = item.kind === 'set' ? item.dishes.slice(1) : [];
  return (
    <View style={styles.item}>
      <View style={styles.itemHead}>
        <View style={styles.itemName}>
          <Txt typography="t5" fontWeight="medium" color="neutral">
            {item.quantity ? `${item.name} ${item.quantity}` : item.name}
          </Txt>
          {item.tags.map((tag) => (
            <Badge key={tag} size="xsmall" color="brandContrast" backgroundColor="brandWeak">
              {tag}
            </Badge>
          ))}
        </View>
        {item.priceKrw !== undefined && (
          <Txt typography="t5" fontWeight="medium" color="neutral">
            {tpl('meals.price', toWon(item.priceKrw))}
          </Txt>
        )}
      </View>
      {sides.length > 0 && (
        <Txt typography="t4" color="neutralMuted">
          {sides.join(' · ')}
        </Txt>
      )}
      {item.options.map((option) => (
        <Txt key={option.name} typography="t4" color="neutralSubtle">
          {`${option.name} ${tpl('meals.extra', toWon(option.extraKrw))}`}
        </Txt>
      ))}
    </View>
  );
}

function Corner({ corner }: { corner: MealsScreenCorner }) {
  const styles = useStyles();
  return (
    <View style={styles.corner}>
      <Txt typography="t3" fontWeight="bold" color="neutralSubtle">
        {corner.title}
      </Txt>
      {corner.kind === 'raw' ? (
        <Txt typography="t4" color="neutralMuted">
          {corner.text}
        </Txt>
      ) : (
        corner.items.map((item, i) => <ItemLine key={`${i}-${item.name}`} item={item} />)
      )}
    </View>
  );
}

export function MealSection({
  title,
  meal,
  onExpandFixed,
}: {
  title: string;
  meal: MealsScreenMeal;
  onExpandFixed?: () => void;
}) {
  const styles = useStyles();
  const { tpl } = useT();
  const [showFixed, setShowFixed] = useState(false);
  // WHY: a fold keeps the same-every-day board from burying today's menu; with no daily menu there is nothing to bury.
  const folded = meal.daily.length > 0;
  const fixedCount = meal.fixed.reduce((n, corner) => n + (corner.kind === 'items' ? corner.items.length : 1), 0);

  return (
    <View style={styles.section}>
      <Txt typography="t7" fontWeight="bold" color="neutral">
        {title}
      </Txt>
      {meal.daily.map((corner) => (
        <Corner key={corner.key} corner={corner} />
      ))}
      {meal.fixed.length > 0 && !folded && meal.fixed.map((corner) => <Corner key={corner.key} corner={corner} />)}
      {meal.fixed.length > 0 && folded && (
        <>
          <TextButton
            typography="t4"
            fontWeight="medium"
            color="neutralMuted"
            variant="arrow"
            onPress={() => {
              if (!showFixed) onExpandFixed?.();
              setShowFixed(!showFixed);
            }}
          >
            {tpl('meals.fixedMenu', fixedCount)}
          </TextButton>
          {showFixed && meal.fixed.map((corner) => <Corner key={corner.key} corner={corner} />)}
        </>
      )}
    </View>
  );
}

const useStyles = createThemedStyles(() => ({
  section: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingTop: SdsSpacing.x5,
    paddingBottom: SdsSpacing.x7,
    gap: SdsSpacing.x5,
  },
  corner: {
    gap: SdsSpacing.x2,
  },
  item: {
    gap: SdsSpacing.x1,
  },
  itemHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SdsSpacing.x3,
  },
  // WHY: tags ride on the name's line and wrap under it when the name is long.
  itemName: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: SdsSpacing.x1_5,
  },
}));
