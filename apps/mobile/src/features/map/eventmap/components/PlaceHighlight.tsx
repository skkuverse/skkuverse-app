/**
 * WHY: the card paints its own fill, because the collapsed sheet is glass and a block without one is text
 * over a moving map.
 */

import React from 'react';
import { ScrollView, View } from 'react-native';
import {
  pickI18nText,
  SdsRadius,
  SdsSpacing,
  useT,
} from '@skkuverse/shared';
import { Tossface, Txt, createThemedStyles } from '@skkuverse/sds';
import { SHEET_GUTTER } from './sheet-layout.constants';
import { HIGHLIGHT_MAX } from '../place-detail.rules';
import type { PlaceBlock, PlaceListItem, PlaceTableRow } from '../place-detail.types';
import { useAppLanguage } from '../../useAppLanguage';

export function PlaceHighlight({ block }: { block: PlaceBlock }) {
  if (block.type === 'list') {
    return <ListPills items={block.items} />;
  }
  if (block.type === 'table') {
    return <TableCard title={block.title} rows={block.rows} />;
  }
  return null;
}

function ListPills({ items }: { items: readonly PlaceListItem[] }) {
  const styles = useStyles();
  const lang = useAppLanguage();
  const shown = items.slice(0, HIGHLIGHT_MAX.list);
  if (shown.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.pills, styles.pillBleed]}
      contentContainerStyle={styles.pillRow}
    >
      {shown.map((item, index) => (
        <View key={`${item.title.ko}-${index}`} style={styles.pill}>
          <Tossface size={14} style={styles.emoji}>{item.emoji ?? '✨'}</Tossface>
          <Txt typography="t3" fontWeight="semiBold" color="neutral" numberOfLines={1}>
            {pickI18nText(item.title, lang)}
          </Txt>
        </View>
      ))}
    </ScrollView>
  );
}

function TableCard({ title, rows }: { title: PlaceBlock['title']; rows: readonly PlaceTableRow[] }) {
  const styles = useStyles();
  const { tpl } = useT();
  const lang = useAppLanguage();
  const first = rows[0];
  if (first === undefined) return null;

  const more = Math.max(0, rows.length - HIGHLIGHT_MAX.table);
  const value = pickI18nText(first.value, lang);
  const description = more > 0 ? `${value} · ${tpl('eventmap.menu.more', more)}` : value;

  return (
    <View style={styles.card}>
      <View style={styles.copy}>
        {title ? (
          <Txt typography="t3" fontWeight="semiBold" color="neutralSubtle">
            {pickI18nText(title, lang)}
          </Txt>
        ) : null}
        <Txt typography="t5" fontWeight="semiBold" color="neutral" numberOfLines={1}>
          {pickI18nText(first.label, lang)}
        </Txt>
        <Txt typography="t3" color="neutralSubtle" numberOfLines={1}>
          {description}
        </Txt>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  card: {
    flexDirection: 'row',
    gap: SdsSpacing.x2,
    minHeight: 72,
    padding: SdsSpacing.x2,
    borderRadius: SdsRadius.r3_5,
    backgroundColor: color.bg.neutralMuted,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: SdsRadius.r3,
    backgroundColor: color.bg.neutralWeak,
  },
  copy: { flex: 1, justifyContent: 'center', gap: SdsSpacing.x0_5 },
  pillRow: { paddingHorizontal: SHEET_GUTTER, gap: SdsSpacing.x2 },
  // WHY: a horizontal ScrollView otherwise expands into the summary's height.
  pills: { flexGrow: 0 },
  pillBleed: { marginHorizontal: -SHEET_GUTTER },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x1_5,
    height: 36,
    // WHY: no max width; a cut menu name is the one thing on the card worth reading, so the row scrolls instead.
    paddingHorizontal: SdsSpacing.x2,
    borderRadius: SdsRadius.full,
    backgroundColor: color.bg.neutralMuted,
  },
  emoji: {
    // eslint-disable-next-line sds/no-type-size-literal -- the emoji's line box inside the 36pt pill; an emoji is not on the type scale
    lineHeight: 16,
  },
}));
