import { View } from 'react-native';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { Tossface, Txt, createThemedStyles } from '@skkuverse/sds';
import type { RideExpansion, RoutePlace, TimelineItemView } from '../campus-routes.types';
import { PlaceLine, RailRow, type OnPlacePress, type RailLine } from './RailRow';
import { RideRows } from './RideRows';

export function RouteTimeline({
  timeline,
  rides,
  onPlacePress,
}: {
  timeline: TimelineItemView[];
  rides: RideExpansion;
  onPlacePress: OnPlacePress;
}) {
  const styles = useStyles();
  const last = timeline.length - 1;
  return (
    <View style={styles.timeline}>
      {timeline.map((item, i) => {
        const above: RailLine = i > 0 ? { kind: 'dashed' } : null;
        const below: RailLine = i < last ? { kind: 'dashed' } : null;
        switch (item.kind) {
          case 'start':
            return (
              <EndRow
                key={i}
                place={item.place}
                word="depart"
                above={above}
                below={below}
                onPlacePress={onPlacePress}
              />
            );
          case 'end':
            return (
              <EndRow
                key={i}
                place={item.place}
                word="arrive"
                above={above}
                below={below}
                onPlacePress={onPlacePress}
              />
            );
          case 'step':
            return <StepRow key={i} emoji={item.emoji} text={item.text} />;
          case 'ride':
            return (
              <RideRows
                key={i}
                ride={item}
                above={above}
                below={below}
                expanded={rides.isExpanded(i)}
                onToggle={() => rides.toggle(i)}
                onPlacePress={onPlacePress}
              />
            );
        }
      })}
    </View>
  );
}

function EndRow({
  place,
  word,
  above,
  below,
  onPlacePress,
}: {
  place: RoutePlace;
  word: 'depart' | 'arrive';
  above: RailLine;
  below: RailLine;
  onPlacePress: OnPlacePress;
}) {
  const styles = useStyles();
  return (
    <RailRow mark={<View style={word === 'depart' ? styles.startDot : styles.endDot} />} above={above} below={below}>
      <PlaceLine
        place={place}
        word={word === 'depart' ? 'campusRoutes.depart' : 'campusRoutes.arrive'}
        onPlacePress={onPlacePress}
      />
    </RailRow>
  );
}

function StepRow({ emoji, text }: { emoji: string; text: string }) {
  const styles = useStyles();
  return (
    <RailRow above={{ kind: 'dashed' }} below={null}>
      <View style={[styles.inline, styles.step]}>
        <Tossface size={14}>{emoji}</Tossface>
        <Txt typography="t3" color="neutralSubtle">
          {text}
        </Txt>
      </View>
    </RailRow>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  timeline: {
    marginTop: SdsSpacing.x3,
  },
  startDot: {
    width: SdsSpacing.x3,
    height: SdsSpacing.x3,
    borderRadius: SdsRadius.full,
    borderWidth: 2,
    borderColor: color.stroke.neutralSolid,
    backgroundColor: color.bg.layerDefault,
  },
  endDot: {
    width: SdsSpacing.x3,
    height: SdsSpacing.x3,
    borderRadius: SdsRadius.full,
    backgroundColor: color.bg.neutralSolid,
  },
  step: {
    paddingVertical: SdsSpacing.x1,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SdsSpacing.x1,
  },
}));
