/**
 * WHY: a row with nothing to say is not drawn; a lone Instagram sits beside the title instead (`soleInstagram`),
 * and the operator's `org` leads the meta line, the server's `subtitle` standing in without one.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  pickI18nText,
  SdsSpacing,
  useT,
} from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import { PlaceActionsRow } from './PlaceActionsRow';
import { PlaceGallery } from './PlaceGallery';
import { PlaceHighlight } from './PlaceHighlight';
import { statusLineOf } from './place-format.rules';
import { heroGallery, highlightBlock, placeBody, soleInstagram } from '../place-detail.rules';
import type { PlaceDetail } from '../place-detail.types';
import type { MapOverlay } from '../../overlay.types';
import { useAppLanguage } from '../../useAppLanguage';

interface PlaceSummaryProps {
  place: MapOverlay;
  detail: PlaceDetail | null;
  now: number;
  onNavigateAway?: () => void;
}

export function PlaceSummary({
  place,
  detail,
  now,
  onNavigateAway,
}: PlaceSummaryProps) {
  const { t, tpl } = useT();
  const lang = useAppLanguage();

  const orgSource = detail?.org ?? place.subtitle;
  const orgText = orgSource ? pickI18nText(orgSource, lang) : null;
  const meta = [
    detail?.locationLabel ? pickI18nText(detail.locationLabel, lang) : null,
    orgText,
  ]
    .filter(Boolean)
    .join(' · ');

  const blocks = detail?.blocks ?? [];
  const highlight = highlightBlock(blocks);
  // WHY: `PlaceBlocks` skips this rail by id, so it is not drawn twice in one sheet.
  const hero = heroGallery(placeBody(blocks));
  const status = statusLineOf(place.hours, now, t, tpl);
  const inlineInstagram = soleInstagram(place.actions, detail?.actions ?? []);

  return (
    <View style={styles.summary}>
      <View style={styles.heading}>
        <Txt typography="t3" color="neutralSubtle">
          {status.text}
        </Txt>
        {meta ? (
          // WHY: two lines, since an operator is often a joint council and one line cut the name mid-word.
          <Txt typography="t3" color="neutralSubtle" numberOfLines={2}>
            {meta}
          </Txt>
        ) : null}
      </View>

      {inlineInstagram ? null : (
        <PlaceActionsRow
          actions={place.actions}
          detailActions={detail?.actions ?? []}
          onNavigateAway={onNavigateAway}
        />
      )}

      {highlight ? <PlaceHighlight block={highlight} /> : null}

      {/* WHY: under the highlight, so the collapsed card's edge cuts a photo rather than a row the visitor acts on. */}
      {hero ? <PlaceGallery images={hero.images} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { gap: SdsSpacing.x3, paddingBottom: SdsSpacing.x5 },
  heading: { gap: SdsSpacing.x1 },
});
