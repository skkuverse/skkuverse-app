import { Fragment, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CaretDownIcon, CaretUpIcon } from 'phosphor-react-native';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { Pressable, Txt, useSemanticColors, createThemedStyles } from '@skkuverse/sds';
import { logNoticesContentSelect } from '@/platform/analytics';
import { useNoticeSiblingItems } from '../useNoticeSiblingItems';
import { findSiblings, type NoticeSibling } from '../siblings.rules';

interface Props {
  sourceId: string;
  articleNo: number;
}

/**
 * WHY: navigation uses `replace`, so back always returns to the list however many notices were read. An end
 * keeps its row ("no previous notice"), so the other row does not jump; with no list context it renders nothing.
 */
export function NoticeSiblingNav({ sourceId, articleNo }: Props) {
  const styles = useStyles();
  const color = useSemanticColors();
  const router = useRouter();
  const { t } = useT();
  const items = useNoticeSiblingItems();
  const { prev, next } = findSiblings(items, sourceId, articleNo);

  const go = useCallback(
    (target: NoticeSibling, direction: 'prev' | 'next') => {
      logNoticesContentSelect({
        content_type:
          direction === 'prev' ? 'detail_sibling_prev' : 'detail_sibling_next',
        item_id: `${target.sourceId}/${target.articleNo}`,
      });
      router.replace(`/notices/${target.sourceId}/${target.articleNo}` as never);
    },
    [router],
  );

  if (items.length === 0) return null;

  // WHY: the list is newest first, so the newer notice ("next") sits above and its arrow points up.
  const rows = [
    {
      key: 'next' as const,
      sibling: next,
      caption: t('notices.siblingNext'),
      empty: t('notices.siblingNextEmpty'),
      Icon: CaretUpIcon,
    },
    {
      key: 'prev' as const,
      sibling: prev,
      caption: t('notices.siblingPrev'),
      empty: t('notices.siblingPrevEmpty'),
      Icon: CaretDownIcon,
    },
  ];

  return (
    <View style={styles.list}>
      {rows.map((row, i) => {
        const disabled = row.sibling === null;
        return (
          <Fragment key={row.key}>
            {i > 0 ? <View style={styles.divider} /> : null}
            <Pressable
              onPress={
                row.sibling ? () => go(row.sibling!, row.key) : undefined
              }
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ disabled }}
              accessibilityLabel={`${row.caption}: ${row.sibling?.title ?? row.empty}`}
              bg="transparent"
              scaleScope="content"
              style={styles.row}
              contentStyle={styles.rowContent}
            >
              <row.Icon
                size={14}
                color={disabled ? color.fg.disabled : color.fg.neutralSubtle}
              />
              <Txt
                typography="t3"
                color={disabled ? 'placeholder' : 'neutralSubtle'}
                style={styles.caption}
              >
                {row.caption}
              </Txt>
              <Txt
                typography="t3"
                fontWeight={disabled ? 'regular' : 'medium'}
                color={disabled ? 'placeholder' : 'neutral'}
                numberOfLines={1}
                style={styles.title}
                lineBreakStrategyIOS="hangul-word"
              >
                {row.sibling?.title ?? row.empty}
              </Txt>
            </Pressable>
          </Fragment>
        );
      })}
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  list: {
    // WHY: flush with the ad above; its own hairline marks the boundary, and more space detaches the list.
    marginTop: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: color.stroke.neutralMuted,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.stroke.neutralSubtle,
  },
  row: {
    paddingVertical: SdsSpacing.x3_5,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x2,
  },
  caption: {
    // WHY: a fixed caption width aligns both titles, since the two captions differ in length by locale.
    width: 52,
    flexShrink: 0,
  },
  title: {
    flex: 1,
  },
}));
