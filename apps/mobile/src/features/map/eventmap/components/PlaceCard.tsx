/**
 * WHY: a fixed layout; the wire carries `subtitle`, `hours`, `fields` and `actions` in authored order. `now` is
 * a prop so the card re-derives when `useWindowEdgeClock` crosses a boundary and nothing else changes.
 */

import { StyleSheet, View } from 'react-native';
import {
  pickI18nText,
  useT,
  SdsSpacing,
} from '@skkuverse/shared';
import { Badge, Txt } from '@skkuverse/sds';
import { formatHours, opennessOf, STATUS_LABEL, STATUS_ROLES } from './place-format.rules';
import type { MapOverlay } from '../../overlay.types';
import { useAppLanguage } from '../../useAppLanguage';

interface PlaceCardProps {
  place: MapOverlay;
  now: number;
  variant?: 'full' | 'compact';
}

export function PlaceCard({ place, now, variant = 'full' }: PlaceCardProps) {
  const { t } = useT();
  const lang = useAppLanguage();
  const compact = variant === 'compact';
  const openness = opennessOf(place.hours, now);
  const status = STATUS_ROLES[openness];

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Txt typography={compact ? 't5' : 't7'} fontWeight="bold" style={styles.title}>
          {pickI18nText(place.text, lang)}
        </Txt>
        <Badge size="small" color={status.color} backgroundColor={status.backgroundColor}>
          {t(STATUS_LABEL[openness])}
        </Badge>
      </View>

      {place.subtitle ? (
        <Txt typography="t3" color="neutralMuted">
          {pickI18nText(place.subtitle, lang)}
        </Txt>
      ) : null}

      <Txt typography="t3" color="neutralSubtle">
        {formatHours(place.hours, t, lang, t('eventmap.hours.always'))}
      </Txt>

      {compact
        ? null
        : place.fields.map((field, index) => (
            // WHY: the index is in the key because the wire gives a field no id, and two rows may share a label.
            <View key={`${field.label.ko}-${index}`} style={styles.fieldRow}>
              <Txt typography="t3" fontWeight="bold" color="neutralMuted">
                {pickI18nText(field.label, lang)}
              </Txt>
              <Txt typography="t3" color="neutral" style={styles.fieldValue}>
                {pickI18nText(field.value, lang)}
              </Txt>
            </View>
          ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: SdsSpacing.x1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SdsSpacing.x2 },
  title: { flexShrink: 1 },
  fieldRow: { flexDirection: 'row', alignItems: 'baseline', gap: SdsSpacing.x1_5 },
  fieldValue: { flexShrink: 1 },
});
