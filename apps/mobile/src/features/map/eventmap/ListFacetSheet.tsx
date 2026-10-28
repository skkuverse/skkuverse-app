/**
 * WHY: a floating card sized to its rows, beside the campus sheet: a quick pick about the view behind it,
 * not a destination. A `required` pick closes it; a checklist stays up between taps.
 */

import { forwardRef } from 'react';
import { StyleSheet } from 'react-native';
import { CheckIcon, CheckSquareIcon, SquareIcon } from 'phosphor-react-native';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { Pressable, Sheet, Txt, useSheetBottomInset, type SheetRef, useSemanticColors } from '@skkuverse/sds';
import { isWholeFacet, toggleChecklist } from './event-list.rules';
import type { MapChipFacet } from '../map-config.types';
import { SHEET_CONTENT_BOTTOM } from '../sheet-detents.constants';

interface ListFacetSheetProps {
  facet: MapChipFacet | null;
  held: readonly string[];
  onChange: (facetId: string, held: readonly string[]) => void;
  bottomGap: number;
}

export const ListFacetSheet = forwardRef<SheetRef, ListFacetSheetProps>(
  function ListFacetSheet({ facet, held, onChange, bottomGap }, ref) {
    const color = useSemanticColors();
    const { t } = useT();
    const multi = facet?.select === 'optional';
    const whole = facet ? isWholeFacet(facet, held) : false;
    const bottomInset = useSheetBottomInset();

    const rows: { id: string | null; label: string; active: boolean }[] = facet
      ? [
          ...(multi ? [{ id: null, label: t('common.total'), active: whole }] : []),
          ...facet.options.map((o) => ({
            id: o.id,
            label: o.label,
            // WHY: under "all" the options read unchecked, since "all" is the one choice made.
            active: held.includes(o.id) && !(multi && whole),
          })),
        ]
      : [];

    const press = (optionId: string | null) => {
      if (!facet) return;
      if (!multi) {
        if (optionId) onChange(facet.id, [optionId]);
        return;
      }
      onChange(facet.id, toggleChecklist(facet, held, optionId));
    };

    return (
      <Sheet
        ref={ref}
        position={{ kind: 'fit' }}
        surface="glass"
        backdrop
        bottomGap={bottomGap}
        stackBehavior="replace"
      >
        <Sheet.View style={[styles.content, { paddingBottom: SHEET_CONTENT_BOTTOM + bottomInset }]}>
          {facet ? (
            <Txt typography="t7" fontWeight="bold" color="neutral" style={styles.title}>
              {facet.label}
            </Txt>
          ) : null}
          {rows.map((row) => (
            <Pressable
              key={row.id ?? '*'}
              accessibilityRole={multi ? 'checkbox' : 'radio'}
              accessibilityState={multi ? { checked: row.active } : { selected: row.active }}
              bg="layerFloating"
              scaleScope="content"
              style={styles.row}
              contentStyle={styles.rowContent}
              onPress={() => press(row.id)}
            >
              <Txt
                typography="t7"
                fontWeight={row.active ? 'semiBold' : 'regular'}
                color={row.active ? 'neutral' : 'neutralSubtle'}
              >
                {row.label}
              </Txt>
              {multi ? (
                row.active ? (
                  <CheckSquareIcon size={22} weight="fill" color={color.fg.brand} />
                ) : (
                  <SquareIcon size={22} color={color.fg.placeholder} />
                )
              ) : row.active ? (
                <CheckIcon size={20} color={color.fg.brand} />
              ) : null}
            </Pressable>
          ))}
        </Sheet.View>
      </Sheet>
    );
  },
);

const styles = StyleSheet.create({
  content: { paddingHorizontal: SdsSpacing.gutter, paddingTop: SdsSpacing.x5 },
  title: { marginBottom: SdsSpacing.x2 },
  row: {
    paddingVertical: SdsSpacing.x3_5,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
