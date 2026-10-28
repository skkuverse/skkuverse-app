/**
 * QUIRK(rnscreens): the FlatList is the Fragment's first child, so it stays RNSScreen's subviews[0], and the
 * chrome is an absolute sibling after it; a sticky Animated header throws on iOS (reanimated#8284).
 * SEE: docs/explanation/ios-26-native-tabs-minimize.md ("How the notices tab applies it")
 */

import type { ReactElement } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  type LayoutChangeEvent,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import {
  useT,
  SdsSpacing,
  type TabRoute,
} from '@skkuverse/shared';
import { Loader, Txt, createThemedStyles } from '@skkuverse/sds';
import { NoticeRow } from './NoticeRow';
import { NoticeListSkeleton } from './NoticeListSkeleton';
import { NoticeEmptyState } from './NoticeEmptyState';
import { useSetNoticeSiblings } from './useSetNoticeSiblings';
import { logNoticesContentSelect } from '@/platform/analytics';
import { useScrollToTopOnRetap } from '@/components/useScrollToTopOnRetap';
import { useTabBarInset } from '@/components/useTabBarInset';
import { useMinimizeOnScroll } from '@/components/useTabBarMinimize';
import { useNoticeList } from './useNoticeList';
import { useMultiSourceNoticeList } from './useMultiSourceNoticeList';
import type { NoticeListItem, NoticePage } from './notices.types';

type Props = (
  | { sourceId: string; sourceIds?: never }
  | { sourceId?: never; sourceIds: string[] }
) & {
  listHeader?: ReactElement;
  /** WHY: inside the list, so it scrolls with the rows; `listHeader` is fixed chrome. */
  listContentHeader?: ReactElement;
  /** WHY: also forwarded to each row as `highlightQuery`, which marks the matched text. */
  q?: string;
  /** WHY: only a tab's root list scrolls to top on re-tap and drives the shared-map bar; a pushed page leaves both alone. */
  scrollsToTopOn?: TabRoute;
};

/**
 * QUIRK(react-native): a FlatList separator never sees its trailing item, so it is one constant hairline;
 * if grouping returns, the gap kind must be precomputed onto each row.
 */
function RowDivider() {
  const styles = useStyles();
  return <View style={styles.divider} />;
}

// WHY: the picker tabs' chrome height; overestimating briefly shows blank space, while under would cover the first row.
const ESTIMATED_CHROME_HEIGHT = 94;

export function NoticeListPanel(props: Props) {
  const styles = useStyles();
  const multi = 'sourceIds' in props && props.sourceIds != null;
  const listHeader = props.listHeader;
  const listContentHeader = props.listContentHeader;
  const q = props.q;
  const router = useRouter();
  const { t } = useT();

  const singleResult = useNoticeList({
    sourceId: multi ? '' : props.sourceId!,
    q,
    enabled: !multi,
  });
  const multiResult = useMultiSourceNoticeList({
    sourceIds: multi ? props.sourceIds! : [],
    q,
    enabled: multi,
  });

  const {
    data,
    isLoading,
    isError,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = multi ? multiResult : singleResult;

  const items = useMemo(
    () => data?.pages.flatMap((p: NoticePage) => p.notices) ?? [],
    [data],
  );

  const navSourceId = multi ? undefined : props.sourceId;
  const setSiblings = useSetNoticeSiblings();
  const handleSelect = useCallback(
    (n: NoticeListItem) => {
      logNoticesContentSelect({
        content_type: 'list_row',
        item_id: `${navSourceId ?? n.sourceId}/${n.articleNo}`,
      });
      // WHY: store the route's own sourceId (the item's on a multi-source tab), or the detail's params never match.
      setSiblings(
        items.map((it) => ({
          sourceId: navSourceId ?? it.sourceId,
          articleNo: it.articleNo,
          title: it.title,
        })),
      );
      router.push(`/notices/${navSourceId ?? n.sourceId}/${n.articleNo}` as never);
    },
    [router, navSourceId, items, setSiblings],
  );

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: NoticeListItem }) => (
      <NoticeRow
        item={item}
        onPress={handleSelect}
        showDepartment={multi}
        highlightQuery={q}
      />
    ),
    [handleSelect, multi, q],
  );

  const [chromeHeight, setChromeHeight] = useState(ESTIMATED_CHROME_HEIGHT);
  const onChromeLayout = useCallback((e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.height;
    if (next > 0 && next !== chromeHeight) setChromeHeight(next);
  }, [chromeHeight]);

  const tabBarInset = useTabBarInset();
  const listRef = useRef<Animated.FlatList<NoticeListItem>>(null);
  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);
  useScrollToTopOnRetap(props.scrollsToTopOn ?? null, scrollToTop);

  // WHY: under the native tabs nothing provides the state, so this drives one nothing reads (ADR 0023 d3).
  const minimizeTabBar = useMinimizeOnScroll();

  const isEmpty = items.length === 0;
  return (
    <>
      <Animated.FlatList
        ref={listRef}
        onScroll={props.scrollsToTopOn ? minimizeTabBar : undefined}
        scrollEventThrottle={16}
        style={[styles.list, listHeader ? { marginTop: chromeHeight } : null]}
        data={items}
        keyExtractor={(n) => n.id}
        renderItem={renderItem}
        ItemSeparatorComponent={RowDivider}
        ListHeaderComponent={listContentHeader}
        contentContainerStyle={[
          styles.listContent,
          isEmpty ? styles.emptyContent : null,
          tabBarInset > 0 ? { paddingBottom: SdsSpacing.x10 + tabBarInset } : null,
        ]}
        scrollIndicatorInsets={tabBarInset > 0 ? { bottom: tabBarInset } : undefined}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        // QUIRK(ios): the indicator sits at the scroll view's top edge, already below the chrome, so no offset is needed.
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        ListEmptyComponent={
          isLoading ? (
            <NoticeListSkeleton />
          ) : isError ? (
            <NoticeEmptyState message={t('notices.error')} onRetry={refetch} />
          ) : q && q.length > 0 ? (
            <NoticeEmptyState message={t('notices.search.empty.subtitle')} />
          ) : (
            <NoticeEmptyState message={t('notices.empty')} onRetry={refetch} />
          )
        }
        ListFooterComponent={
          isEmpty ? null : isFetchingNextPage ? (
            <View style={styles.footer}>
              <Loader size="small" tone="neutral" />
            </View>
          ) : !hasNextPage && items.length > 0 ? (
            <View style={styles.endOfList}>
              <Txt typography="t3" color="neutralSubtle">
                {t('notices.endOfList')}
              </Txt>
            </View>
          ) : null
        }
      />
      {/* QUIRK(rnscreens): after the FlatList so subviews[0] stays the scroll view; box-none passes taps through. */}
      {listHeader && (
        <View
          style={styles.chromeOverlay}
          onLayout={onChromeLayout}
          pointerEvents="box-none"
        >
          {listHeader}
        </View>
      )}
    </>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: SdsSpacing.x10,
  },
  emptyContent: {
    flexGrow: 1,
  },
  // WHY: `marginLeft: 24` aligns the line with the row text (DIV-01).
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.stroke.neutralSubtle,
    marginLeft: SdsSpacing.x6,
  },
  footer: {
    paddingVertical: SdsSpacing.x5,
  },
  endOfList: {
    paddingVertical: SdsSpacing.x6,
    alignItems: 'center',
  },
  chromeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: color.bg.layerFloating,
  },
}));
