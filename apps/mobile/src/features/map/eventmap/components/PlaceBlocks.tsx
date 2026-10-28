/**
 * WHY: no exhaustive `never` arm: `PlaceBlock['type']` is an open enum, and an assertion would blank a whole
 * body on an older build the day the server ships a new type.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
} from 'react-native';
import {
  pickI18nText,
  SdsRadius,
  SdsSpacing,
  useT,
  type I18nText,
} from '@skkuverse/shared';
import { Border, ListRow, TextButton, Tossface, Txt, createThemedStyles } from '@skkuverse/sds';
import { PlaceGallery } from './PlaceGallery';
import { trackPlaceAction } from './usePlaceNavigate';
import { heroGallery, placeBody } from '../place-detail.rules';
import type { PlaceBlock, PlaceListItem, PlaceTableRow } from '../place-detail.types';
import { useAppLanguage } from '../../useAppLanguage';

const TEXT_LINES = 3;

export function PlaceBlocks({ blocks }: { blocks: readonly PlaceBlock[] }) {
  const styles = useStyles();
  // WHY: the summary draws the first image rail under the highlight, so the body skips it; later rails stay.
  const body = placeBody(blocks);
  const heroId = heroGallery(body)?.id;
  return (
    <View style={styles.body}>
      {body
        .filter((item) => item.id !== heroId)
        .map((item) =>
          item.type === 'gallery' ? (
            <PlaceGallery key={item.id} images={item.images} />
          ) : (
            <PlaceBlockView key={item.id} block={item.block} />
          ),
        )}
    </View>
  );
}

function PlaceBlockView({ block }: { block: PlaceBlock }) {
  switch (block.type) {
    case 'text':
      return <TextBlock title={block.title} body={block.body} />;
    case 'list':
      return <ListBlock title={block.title} items={block.items} />;
    case 'table':
      return <TableBlock title={block.title} rows={block.rows} />;
    case 'image':
      return null;
    case 'notice':
      return <NoticeBlock title={block.title} items={block.items} />;
    // WHY: no `never` arm; an unknown block type renders nothing.
    default:
      return null;
  }
}

function BlockTitle({ title }: { title: I18nText | null }) {
  const styles = useStyles();
  const lang = useAppLanguage();
  if (title === null) return null;
  return (
    <Txt typography="t3" fontWeight="semiBold" color="neutralSubtle" style={styles.blockTitle}>
      {pickI18nText(title, lang)}
    </Txt>
  );
}

function TextBlock({ title, body }: { title: I18nText | null; body: I18nText }) {
  const styles = useStyles();
  const { t } = useT();
  const lang = useAppLanguage();
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const text = pickI18nText(body, lang);

  // WHY: measured on an unclamped copy; a clamped `Text` reports only the lines it drew.
  const onMeasure = useCallback((e: NativeSyntheticEvent<TextLayoutEventData>) => {
    setOverflows(e.nativeEvent.lines.length > TEXT_LINES);
  }, []);

  return (
    <View>
      <BlockTitle title={title} />
      <View style={styles.quote}>
        {/* WHY: both copies share this box, so the unclamped one wraps at the clamped width; a wider box would report fewer lines and hide the more link. */}
        <View style={styles.quoteText}>
          <Txt typography="t5" color="neutral" onTextLayout={onMeasure} style={styles.measure}>
            {text}
          </Txt>
          <Txt typography="t5" color="neutral" numberOfLines={expanded ? undefined : TEXT_LINES}>
            {text}
          </Txt>
          {overflows ? (
            <TextButton
              typography="t3"
              fontWeight="semiBold"
              color="neutralSubtle"
              onPress={() => {
                if (!expanded) trackPlaceAction('expand_text');
                setExpanded((v) => !v);
              }}
              style={styles.moreButton}
            >
              {t(expanded ? 'eventmap.less' : 'eventmap.more')}
            </TextButton>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function ListBlock({ title, items }: { title: I18nText | null; items: readonly PlaceListItem[] }) {
  const styles = useStyles();
  const lang = useAppLanguage();
  return (
    <View>
      <BlockTitle title={title} />
      {items.map((item, i) => (
        <ListRow
          key={`${item.title.ko}-${i}`}
          horizontalPadding={0}
          verticalPadding="xsmall"
          // WHY: with a description under the name, the emoji stays level with the name instead of drifting down.
          leftAlignment={item.description ? 'top' : 'center'}
          left={
            <View style={styles.emoji}>
              <Tossface size={18} style={styles.emojiText}>{item.emoji ?? '✨'}</Tossface>
            </View>
          }
          contents={
            item.description ? (
              <ListRow.Texts
                layout="2RowTypeA"
                top={pickI18nText(item.title, lang)}
                topProps={{ typography: 't5', fontWeight: 'semiBold' }}
                bottom={pickI18nText(item.description, lang)}
                bottomProps={{ typography: 't3' }}
              />
            ) : (
              <ListRow.Texts
                layout="1RowTypeA"
                top={pickI18nText(item.title, lang)}
                topProps={{ typography: 't5', fontWeight: 'semiBold' }}
              />
            )
          }
        />
      ))}
    </View>
  );
}

function TableBlock({ title, rows }: { title: I18nText | null; rows: readonly PlaceTableRow[] }) {
  const styles = useStyles();
  const lang = useAppLanguage();
  return (
    <View>
      <BlockTitle title={title} />
      {rows.map((r, i) => (
        <React.Fragment key={`${r.label.ko}-${i}`}>
          {i > 0 ? <Border variant="full" /> : null}
          <ListRow
            horizontalPadding={0}
            // EVIDENCE: ListRow's 16 spread a seven-line menu over most of the sheet; a price list is scanned.
            containerStyle={styles.tableRow}
            contents={
              <ListRow.Texts
                layout="1RowTypeC"
                top={pickI18nText(r.label, lang)}
                topProps={{ color: 'neutral' }}
              />
            }
            right={
              <Txt typography="t5" fontWeight="semiBold" color="neutral">
                {pickI18nText(r.value, lang)}
              </Txt>
            }
          />
        </React.Fragment>
      ))}
    </View>
  );
}

function NoticeBlock({ title, items }: { title: I18nText | null; items: readonly I18nText[] }) {
  const styles = useStyles();
  const lang = useAppLanguage();
  return (
    <View>
      <BlockTitle title={title} />
      <View style={styles.bullets}>
        {items.map((item, i) => (
          <View key={`${item.ko}-${i}`} style={styles.bulletRow}>
            <Txt typography="t5" color="neutralSubtle" style={styles.bulletMark}>
              •
            </Txt>
            <Txt typography="t5" color="neutral" style={styles.bulletText}>
              {pickI18nText(item, lang)}
            </Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  body: { gap: SdsSpacing.x6 },
  blockTitle: { marginBottom: SdsSpacing.x1 },
  quote: { flexDirection: 'row', borderLeftWidth: 3, borderLeftColor: color.stroke.neutralWeak, paddingLeft: SdsSpacing.x4 },
  quoteText: { flex: 1 },
  measure: { position: 'absolute', left: 0, right: 0, opacity: 0 },
  moreButton: { marginTop: SdsSpacing.x1 },
  emoji: {
    width: 36,
    height: 36,
    borderRadius: SdsRadius.r3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.bg.brandWeak,
  },
  // eslint-disable-next-line sds/no-type-size-literal -- the emoji's line box, matched to the row's first text line; an emoji is not on the type scale
  emojiText: { lineHeight: 22 },
  tableRow: { paddingVertical: SdsSpacing.x3 },
  bullets: { gap: SdsSpacing.x2 },
  bulletRow: { flexDirection: 'row', gap: SdsSpacing.x2 },
  bulletMark: { paddingTop: SdsSpacing.x0_5 },
  bulletText: { flex: 1 },
}));
