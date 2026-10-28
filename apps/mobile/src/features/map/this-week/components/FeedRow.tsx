import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { CalendarDotsIcon, MapPinIcon, StorefrontIcon, UsersThreeIcon } from 'phosphor-react-native';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { Badge, ListRow, Tossface, Txt, createThemedStyles, useSemanticColors, useSurface } from '@skkuverse/sds';
import { toThumbnail, toThumbnailFrame } from '../this-week.rules';
import type { ThisWeekItem, ThisWeekScreenRowText, ThisWeekScreenThumbnail } from '../this-week.types';

interface FeedRowProps {
  text: ThisWeekScreenRowText;
  onOpen: (item: ThisWeekItem) => void;
}

const TILE = SdsSpacing.x12;
const KIND_ICON = SdsSpacing.x6;

/** WHY: the smallest icon ICON-02 allows, filled as ICON-03 asks at that size. */
const PIN = 12;

/** WHY: a closed sign-up keeps the Badge's neutral default (BADGE-02). */
const RECRUITING = { color: 'informativeContrast', backgroundColor: 'informativeWeak' } as const;

/** WHY: nothing sits to the right of the text, so every row's text starts at one x. */
export function FeedRow({ text, onOpen }: FeedRowProps) {
  const styles = useStyles();
  const color = useSemanticColors();
  const { row, qualifier } = text;
  const [failed, setFailed] = useState(false);
  const thumbnail = toThumbnail(row.item, failed);
  return (
    <ListRow
      horizontalPadding={0}
      verticalPadding="xsmall"
      leftAlignment="top"
      onPress={() => onOpen(row.item)}
      accessibilityRole="button"
      left={
        thumbnail.kind === 'image' ? (
          <Thumbnail key={thumbnail.url} url={thumbnail.url} onError={() => setFailed(true)} />
        ) : (
          <KindIcon thumbnail={thumbnail} />
        )
      }
      contents={
        <View style={styles.texts}>
          <View style={styles.line1}>
            {text.token !== null ? (
              <Badge size="xsmall" {...(row.token === 'recruiting' ? RECRUITING : null)}>
                {text.token}
              </Badge>
            ) : null}
            <Txt typography="t5" fontWeight="bold" numberOfLines={1} style={styles.shrink}>
              {row.title}
            </Txt>
          </View>
          <WholeUnits
            first={
              <Txt typography="t3" color="neutralSubtle" numberOfLines={1} style={styles.shrink}>
                {text.when}
              </Txt>
            }
            second={
              qualifier ? (
                <Txt typography="t3" color={qualifier.tone === 'urgent' ? 'criticalContrast' : 'neutralSubtle'} numberOfLines={1} style={styles.shrink}>
                  {qualifier.tone === 'benefit' ? <Tossface>{'\u{1F381} '}</Tossface> : null}
                  {qualifier.text}
                </Txt>
              ) : null
            }
          />
          <View style={styles.placeLine}>
            <MapPinIcon size={PIN} weight="fill" color={color.fg.neutralSubtle} />
            <Txt typography="t3" color="neutralSubtle" numberOfLines={1} style={styles.shrink}>
              {text.place}
            </Txt>
          </View>
        </View>
      }
    />
  );
}

/**
 * WHY: never a break inside a unit, so a deadline or a benefit never splits across lines. The separator stays
 * at the end of the first unit and, once the second moves down, is hidden but keeps its width, so hiding it
 * cannot pull the second back up.
 */
function WholeUnits({ first, second }: { first: ReactNode; second: ReactNode | null }) {
  const styles = useStyles();
  const [tops, setTops] = useState<{ first: number | null; second: number | null }>({ first: null, second: null });
  const movedDown = tops.first !== null && tops.second !== null && tops.second > tops.first;
  const track = (unit: 'first' | 'second') => (y: number) => setTops((prev) => (prev[unit] === y ? prev : { ...prev, [unit]: y }));
  return (
    <View style={styles.units}>
      <View style={styles.unit} onLayout={(e) => track('first')(e.nativeEvent.layout.y)}>
        {first}
        {second !== null ? (
          // WHY: the separator is drawn, not read: a screen reader hears the two units as two phrases.
          <Txt
            typography="t3"
            color="neutralSubtle"
            style={movedDown ? styles.hidden : undefined}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            {' · '}
          </Txt>
        ) : null}
      </View>
      {second !== null ? (
        <View style={styles.unit} onLayout={(e) => track('second')(e.nativeEvent.layout.y)}>
          {second}
        </View>
      ) : null}
    </View>
  );
}

const KIND_ICONS = { event: CalendarDotsIcon, operation: StorefrontIcon, call: UsersThreeIcon } as const;

/** WHY: inside a glass sheet the tile is the glass control fill, since `neutralWeak` vanishes there. */
function KindIcon({ thumbnail }: { thumbnail: Extract<ThisWeekScreenThumbnail, { kind: 'icon' }> }) {
  const styles = useStyles();
  const color = useSemanticColors();
  const glass = useSurface() === 'glass';
  const Icon = KIND_ICONS[thumbnail.itemKind];
  return (
    <View style={[styles.thumb, styles.icon, glass && styles.thumbOnGlass]}>
      <Icon size={KIND_ICON} weight="fill" color={color.fg.neutralSubtle} />
    </View>
  );
}

/** WHY: the shape is kept as one number, so the load event a resize replays leaves the row as it is. */
function Thumbnail({ url, onError }: { url: string; onError: () => void }) {
  const styles = useStyles();
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const frame = toThumbnailFrame(aspectRatio);
  return (
    <View style={[styles.thumb, styles.clip]}>
      <Image
        source={url}
        style={
          frame.kind === 'portrait'
            ? [styles.image, { aspectRatio: frame.aspectRatio }]
            : [styles.image, styles.fill, frame.kind === 'pending' && styles.pending]
        }
        contentFit="cover"
        onLoad={(e) => setAspectRatio(e.source.width / e.source.height)}
        onError={onError}
      />
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  texts: {
    gap: SdsSpacing.x0_5,
  },
  line1: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x1_5,
  },
  shrink: {
    flexShrink: 1,
  },
  units: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  unit: {
    flexDirection: 'row',
    flexShrink: 1,
    maxWidth: '100%',
  },
  hidden: {
    opacity: 0,
  },
  placeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x1,
  },
  thumb: {
    width: TILE,
    height: TILE,
    borderRadius: SdsRadius.r2,
    backgroundColor: color.bg.neutralWeak,
  },
  thumbOnGlass: {
    backgroundColor: color.bg.glassControl,
  },
  clip: {
    overflow: 'hidden',
  },
  image: {
    width: '100%',
  },
  fill: {
    height: '100%',
  },
  pending: {
    opacity: 0,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
