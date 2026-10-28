import { View } from 'react-native';
import { CaretRightIcon } from 'phosphor-react-native';
import { hexToColor, legibleOn, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { LineMarker } from '@/components/LineMarker';
import { TransitGlyph } from './TransitGlyph';
import { Pressable, createThemedStyles, useResolvedScheme, useSemanticColors, Txt } from '@skkuverse/sds';
import type { TransitRowItem } from '../transit.types';

export const TRANSIT_TITLE_INSET = SdsSpacing.gutter + SdsSpacing.x6 + SdsSpacing.x3_5;

// WHY: any other glyph type is newer than this build and falls back to the default.
const BUNDLED_GLYPHS = new Set(['shuttle', 'village', 'subway']);

// WHY: in dark mode the badge color is lifted until its text holds 4.5:1 on this fill (`legibleOn`).
const BADGE_FILL = 0x1f / 255;

interface TransitItemRowProps {
  item: TransitRowItem;
  onPress: () => void;
  inset?: boolean;
  divider?: boolean;
}

export function TransitItemRow({ item, onPress, inset = false, divider = true }: TransitItemRowProps) {
  const semantic = useSemanticColors();
  const scheme = useResolvedScheme();
  const styles = useStyles();
  const badgeColor = (hex: string) => {
    const served = hexToColor(hex, semantic.bg.dataBrand);
    return scheme === 'dark' ? legibleOn(served, semantic.bg.layerDefault, { fill: BADGE_FILL }) : served;
  };
  const badge = item.kind === 'subway' ? null : { text: item.icon.text, color: badgeColor(item.icon.color) };
  const glyph =
    item.kind === 'subway' ? 'subway' : BUNDLED_GLYPHS.has(item.icon.type) ? item.icon.type : 'default';

  return (
    <>
      <Pressable
        bg="layerDefault"
        scaleScope="content"
        style={[styles.row, inset && styles.insetRow]}
        contentStyle={styles.rowContent}
        onPress={onPress}
      >
        <TransitGlyph iconType={glyph} size={24} />

        <View style={styles.content}>
          <View style={styles.labelRow}>
            <Txt typography="t5" fontWeight="bold" style={styles.label} numberOfLines={1}>
              {item.title}
            </Txt>
            {item.kind === 'subway' ? (
              <View style={styles.markers}>
                {item.lines.map((l) => (
                  <LineMarker key={l.code} text={l.marker.text} color={l.marker.color} />
                ))}
              </View>
            ) : (
              badge && (
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: badge.color + '1F',
                        borderColor: badge.color + '4D',
                      },
                    ]}
                  >
                    <Txt typography="t1" fontWeight="medium" style={{ color: badge.color }}>
                      {badge.text}
                    </Txt>
                  </View>
                )
            )}
          </View>

          {item.subtitle != null && (
            <Txt typography="t3" style={styles.subtitle} numberOfLines={1}>
              {item.subtitle}
            </Txt>
          )}
        </View>

        <CaretRightIcon size={20} color={semantic.fg.placeholder} />
      </Pressable>
      {divider && <View style={[styles.divider, inset && styles.insetDivider]} />}
    </>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  row: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingVertical: SdsSpacing.x2_5,
  },
  insetRow: {
    paddingLeft: TRANSIT_TITLE_INSET,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x3_5,
  },
  content: {
    flex: 1,
    gap: SdsSpacing.x0_5,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x2,
  },
  label: {
    color: color.fg.neutral,
    flexShrink: 1,
  },
  markers: {
    flexDirection: 'row',
    gap: SdsSpacing.x1,
  },
  badge: {
    borderWidth: 0.5,
    borderRadius: SdsRadius.r1,
    paddingHorizontal: SdsSpacing.x1,
    paddingVertical: 0,
  },
  subtitle: {
    color: color.fg.neutralSubtle,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  divider: {
    height: 0.5,
    backgroundColor: color.stroke.neutralSubtle,
    marginLeft: SdsSpacing.gutter,
  },
  insetDivider: {
    marginLeft: TRANSIT_TITLE_INSET,
  },
}));
