
import { BusIcon } from 'phosphor-react-native';
import { useT } from '@skkuverse/shared';
import { useSemanticColors } from '@skkuverse/sds';
import { ReviewPromptHost } from '@/features/feedback/ReviewPromptHost';
import { MapSheetStack } from '@/features/map/MapSheetStack';
import { TransitSheetBody } from './components/TransitSheetBody';
import { useTransitMapTab } from './useTransitMapTab';

export function TransitMapTab() {
  const color = useSemanticColors();
  const { t } = useT();
  const {
    data,
    isLoading,
    isError,
    groups,
    loadError,
    openRow,
    reviewHost,
    onRootDetent,
    bottomPadding,
  } = useTransitMapTab({
    reviewIcon: <BusIcon size={32} color={color.fg.brandContrast} weight="fill" />,
  });

  return (
    <>
      <MapSheetStack
        tab="transit"
        root={{
          profile: 'transitRoot',
          onDetent: onRootDetent,
          label: t('nav.transit'),
          body: (
            <TransitSheetBody
              data={data}
              isLoading={isLoading}
              isError={isError}
              groups={groups}
              onOpenRow={openRow}
              onRetry={loadError.onRetry}
              bottomPadding={bottomPadding}
            />
          ),
        }}
      />
      <ReviewPromptHost {...reviewHost} />
    </>
  );
}
