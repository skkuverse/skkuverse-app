/**
 * WHY: each block assumes it has something to draw, and `ListRow`'s own inset is off because the sheet's
 * scroll content already carries the gutter.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ClockIcon, MapPinIcon } from 'phosphor-react-native';
import {
  pickI18nText,
  SdsRadius,
  SdsSpacing,
  useT,
} from '@skkuverse/shared';
import { Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import { formatHoursLines } from './place-format.rules';
import type { PlaceDetail } from '../place-detail.types';
import type { MapOverlay } from '../../overlay.types';
import { useAppLanguage } from '../../useAppLanguage';

const ICON_SIZE = 19;

export function FactsSection({ place, detail }: { place: MapOverlay; detail: PlaceDetail | null }) {
  const styles = useStyles();
  const color = useSemanticColors();
  const { t } = useT();
  const lang = useAppLanguage();
  // WHY: `locationLabel` alone, never `place.subtitle`: the subtitle is free text ops wrote (a bay number, an
  // operating note), which already shows once in the summary's meta line.
  const location = detail?.locationLabel ? pickI18nText(detail.locationLabel, lang) : null;

  return (
    <View style={styles.facts}>
      {location ? (
        <FactRow
          icon={<MapPinIcon size={ICON_SIZE} color={color.fg.neutralSubtle} />}
          label={t('eventmap.info.location')}
          text={location}
        />
      ) : null}
      <HoursFactRow hours={place.hours} />
    </View>
  );
}

/**
 * WHY: every window on its own dated line, never folded: a festival has at most two, and the date is the
 * part a visitor needs.
 */
function HoursFactRow({ hours }: { hours: MapOverlay['hours'] }) {
  const color = useSemanticColors();
  const { t } = useT();
  const lang = useAppLanguage();
  const text =
    hours.length === 0 ? t('eventmap.hours.always') : formatHoursLines(hours, t, lang).join('\n');

  return (
    <FactRow
      icon={<ClockIcon size={ICON_SIZE} color={color.fg.neutralSubtle} />}
      label={t('eventmap.info.hours')}
      text={text}
    />
  );
}

function FactRow({ icon, label, text }: { icon: React.ReactNode; label: string; text: string }) {
  const styles = useStyles();
  return (
    <View style={styles.factRow}>
      <View style={styles.factLabel}>
        <View style={styles.factIcon}>{icon}</View>
        <Txt typography="t3" color="neutralSubtle" numberOfLines={1}>
          {label}
        </Txt>
      </View>
      <View style={styles.factValue}>
        <Txt typography="t3" color="neutral" style={styles.factText}>
          {text}
        </Txt>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  facts: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.stroke.neutralMuted,
    borderRadius: SdsRadius.r3_5,
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: SdsSpacing.x4,
    paddingVertical: SdsSpacing.x3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.stroke.neutralSubtle,
  },
  factLabel: {
    width: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x1,
    paddingTop: SdsSpacing.x0_5,
    paddingRight: SdsSpacing.x2,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: color.stroke.neutralSubtle,
  },
  factIcon: { width: 20, alignItems: 'center' },
  factValue: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', paddingLeft: SdsSpacing.x4 },
  factText: { flex: 1 },
  noticeStack: { flex: 1, gap: SdsSpacing.x2, paddingLeft: SdsSpacing.x4 },
  noticeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SdsSpacing.x2 },
  noticeBullet: { paddingTop: SdsSpacing.x0_5 },
  introQuote: { borderLeftWidth: 3, borderLeftColor: color.stroke.neutralWeak, paddingLeft: SdsSpacing.x4 },
  introRow: { flexDirection: 'row', gap: SdsSpacing.x3 },
  logo: {
    width: 56,
    height: 56,
    borderRadius: SdsRadius.r3,
    backgroundColor: color.bg.neutralWeak,
  },
  introText: { flex: 1 },
  measure: { position: 'absolute', left: 0, right: 0, opacity: 0 },
  moreButton: { marginTop: SdsSpacing.x1 },
  bullets: { gap: SdsSpacing.x2 },
  bulletRow: { flexDirection: 'row', gap: SdsSpacing.x2 },
  bulletText: { flex: 1 },
  priceRow: { paddingVertical: SdsSpacing.x3 },
  menuGroupTitle: { marginTop: SdsSpacing.x5, marginBottom: SdsSpacing.x1 },
  disclaimer: { marginTop: SdsSpacing.x4 },
}));
