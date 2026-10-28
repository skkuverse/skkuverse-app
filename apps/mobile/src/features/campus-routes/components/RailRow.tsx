import type { ReactNode } from 'react';
import { View } from 'react-native';
import { CaretRightIcon } from 'phosphor-react-native';
import { hexToColor, SdsSpacing, useT, type TranslationKey } from '@skkuverse/shared';
import { Pressable, Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import type { PlaceAction, RoutePlace } from '../campus-routes.types';

export const MARK = SdsSpacing.x7;
const RAIL = SdsSpacing.x8;
const SOLID = 4;
const DASHED = 2;

export type OnPlacePress = (action: PlaceAction) => void;

export function useLineColor(hex: string | undefined): string | null {
  const color = useSemanticColors();
  return hex === undefined ? null : hexToColor(hex, color.bg.dataBrand);
}

export type RailLine = { kind: 'solid'; color: string | null } | { kind: 'dashed' } | null;

export function RailRow({
  mark,
  above,
  below,
  children,
}: {
  mark?: ReactNode;
  above: RailLine;
  below: RailLine;
  children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <RailSegment line={above} style={mark ? styles.railAbove : styles.railFull} />
        {mark ? <RailSegment line={below} style={styles.railBelow} /> : null}
        {mark ? <View style={styles.markSlot}>{mark}</View> : null}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

function RailSegment({ line, style }: { line: RailLine; style: object }) {
  const styles = useStyles();
  const color = useSemanticColors();
  if (!line) return null;
  if (line.kind === 'dashed') return <View style={[styles.dashed, style]} />;
  return <View style={[styles.solid, style, { backgroundColor: line.color ?? color.stroke.neutralWeak }]} />;
}

export function PlaceLine({
  place,
  word,
  weight = 'bold',
  onPlacePress,
}: {
  place: RoutePlace;
  word?: TranslationKey;
  weight?: 'bold' | 'regular';
  onPlacePress: OnPlacePress;
}) {
  const styles = useStyles();
  const color = useSemanticColors();
  const { t } = useT();
  const { action } = place;
  const content = (
    <>
      <Txt
        typography={weight === 'bold' ? 't5' : 't4'}
        fontWeight={weight}
        color="neutral"
        numberOfLines={1}
        style={styles.shrink}
      >
        {place.name}
      </Txt>
      {word ? (
        <Txt typography="t4" color="neutralSubtle">
          {t(word)}
        </Txt>
      ) : null}
      {action ? <CaretRightIcon size={SdsSpacing.x4} color={color.fg.placeholder} /> : null}
    </>
  );
  return action ? (
    <Pressable
      bg="layerDefault"
      scaleScope="content"
      style={styles.shrink}
      contentStyle={styles.placeLine}
      onPress={() => onPlacePress(action)}
    >
      {content}
    </Pressable>
  ) : (
    <View style={[styles.placeLine, styles.shrink]}>{content}</View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  row: {
    flexDirection: 'row',
    gap: SdsSpacing.x2,
  },
  rail: {
    width: RAIL,
  },
  railFull: {
    top: 0,
    bottom: 0,
  },
  railAbove: {
    top: 0,
    height: MARK / 2,
  },
  railBelow: {
    top: MARK / 2,
    bottom: 0,
  },
  solid: {
    position: 'absolute',
    left: (RAIL - SOLID) / 2,
    width: SOLID,
  },
  // QUIRK(react-native): a dashed border draws only on all four sides, so the dash is a 2-wide box.
  dashed: {
    position: 'absolute',
    left: (RAIL - DASHED) / 2,
    width: DASHED,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.stroke.neutralWeak,
  },
  markSlot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: MARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: SdsSpacing.x1,
    paddingBottom: SdsSpacing.x3,
  },
  placeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x1,
    minHeight: MARK,
  },
  shrink: {
    flexShrink: 1,
  },
}));
