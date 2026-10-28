import { useCallback, useRef } from 'react';
import { View } from 'react-native';
import type { BottomSheetScrollViewMethods } from '@gorhom/bottom-sheet';
import { BusIcon } from 'phosphor-react-native';
import { SdsSpacing, useT } from '@skkuverse/shared';
import { ResultSection, Sheet, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import { useScrollToTopOnRetap } from '@/components/useScrollToTopOnRetap';
import { PromoCard } from '@/features/promo/PromoCard';
import { TransitSections } from './TransitSections';
import { TransitSkeleton } from './TransitSkeleton';
import type { TransitGroup, TransitLayout, TransitRowItem } from '../transit.types';

interface TransitSheetBodyProps {
  data: TransitLayout | undefined;
  isLoading: boolean;
  isError: boolean;
  groups: { isExpanded: (group: TransitGroup) => boolean; onToggle: (group: TransitGroup) => void };
  onOpenRow: (item: TransitRowItem, sectionId: string, groupId?: string) => void;
  onRetry: () => void;
  bottomPadding: number;
}

export function TransitSheetBody({
  data,
  isLoading,
  isError,
  groups,
  onOpenRow,
  onRetry,
  bottomPadding,
}: TransitSheetBodyProps) {
  const styles = useStyles();
  const { t } = useT();
  const color = useSemanticColors();

  const scrollRef = useRef<BottomSheetScrollViewMethods>(null);
  const scrollToTop = useCallback(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), []);
  useScrollToTopOnRetap('transit', scrollToTop);

  const viewportRef = useRef<View>(null);

  return (
    <View ref={viewportRef} collapsable={false} style={styles.viewport}>
      <Sheet.ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={{ paddingBottom: bottomPadding }}>
        {isLoading ? (
          <TransitSkeleton />
        ) : isError || !data ? (
          <ResultSection
            size="large"
            asset={<BusIcon size={SdsSpacing.x10} color={color.fg.neutralSubtle} />}
            title={t('transit.loadFailed')}
            primaryActionProps={{ children: t('common.retry'), onPress: onRetry }}
          />
        ) : (
          <>
            {/* WHY: only once the rows are there, so the card never shifts them. */}
            <PromoCard slot="transit_top" viewportRef={viewportRef} bottomInset={bottomPadding} />
            <TransitSections sections={data.sections} groups={groups} onOpenRow={onOpenRow} />
          </>
        )}
      </Sheet.ScrollView>
    </View>
  );
}

const useStyles = createThemedStyles(() => ({
  viewport: {
    flex: 1,
  },
  scroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },
}));
