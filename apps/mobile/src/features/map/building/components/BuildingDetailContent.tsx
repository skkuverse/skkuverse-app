import { useMemo, useCallback, useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { MapTrifoldIcon } from 'phosphor-react-native';
import {
  SdsSpacing,
  getLocalizedText,
  useT,
  SdsRadius,
} from '@skkuverse/shared';
import {
  Loader,
  ListHeader,
  ListRow,
  Sheet,
  SheetCloseButton,
  useSheetBottomInset,
  useSemanticColors,
  createThemedStyles,
} from '@skkuverse/sds';
import { BuildingDescription } from './BuildingDescription';
import { BuildingHeader } from './BuildingHeader';
import { ConnectionsSection } from './ConnectionsSection';
import { FloorGuide } from './FloorGuide';
import { floorIndexOfSpace } from './floor-guide.rules';
import { getHsscBuildingName } from '@/features/hssc/building-names.constants';
import { logBuildingView, logConnectionMapOpen } from '@/platform/analytics';
import type { BuildingDetailSource } from '@/platform/analytics.types';
import { useBuildingDetail } from '../useBuildingDetail';
import { useAppLanguage } from '../../useAppLanguage';
import { SHEET_CONTENT_BOTTOM } from '../../sheet-detents.constants';

interface BuildingDetailContentProps {
  skkuId: number;
  highlightSpaceCd?: string;
  source: BuildingDetailSource;
  onConnectionTap: (targetSkkuId: number) => void;
  onClose: () => void;
  /** WHY: called before pushing the floor map, so a card can dismiss itself first. */
  onNavigateAway?: () => void;
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <>
      <View style={styles.sectionDivider} />
      <ListHeader
        title={
          <ListHeader.TitleParagraph typography="t7" fontWeight="bold">
            {title}
          </ListHeader.TitleParagraph>
        }
      />
      {children}
    </>
  );
}

export function BuildingDetailContent({
  skkuId,
  highlightSpaceCd,
  source,
  onConnectionTap,
  onClose,
  onNavigateAway,
}: BuildingDetailContentProps) {
  const styles = useStyles();
  const color = useSemanticColors();
  const { data, isLoading } = useBuildingDetail(skkuId);
  const lang = useAppLanguage();
  const { t } = useT();
  const bottomInset = useSheetBottomInset();
  const router = useRouter();

  const highlightedFloor = useMemo(
    () => (data ? floorIndexOfSpace(data.floors, highlightSpaceCd) : null),
    [data, highlightSpaceCd],
  );
  // WHY: keyed, not reset in an effect, so a new building or highlighted floor mounts the stateful sections
  // fresh and no frame shows the previous one's state.
  const sectionKey = `${skkuId}:${highlightedFloor}`;

  const description = data?.building.description
    ? getLocalizedText(data.building.description, lang)
    : null;

  // WHY: no logScreenView; GA4 treats screen_view as the current screen, and a sheet would leave it stuck
  // after closing, since the pathname does not change. `building_view` records the sheet.
  useEffect(() => {
    if (!data) return;
    logBuildingView({
      skkuId: data.building.skkuId,
      buildingName: getLocalizedText(data.building.name, lang),
      campus: data.building.campus,
      source,
    });
  }, [data?.building.skkuId]); // eslint-disable-line react-hooks/exhaustive-deps -- one view per building, not per refetch or language change

  const hsscMapName = useMemo(() => {
    if (!data) return null;
    const nameKo = getLocalizedText(data.building.name, 'ko');
    return getHsscBuildingName(nameKo);
  }, [data]);

  const handleFloorMapPress = useCallback(() => {
    if (!hsscMapName) return;
    logConnectionMapOpen('hssc');
    onNavigateAway?.();
    router.push(`/map/hssc?building=${encodeURIComponent(hsscMapName)}` as never);
  }, [hsscMapName, onNavigateAway, router]);

  return (
    <>
      {/* WHY: the X sits beside the scroll view so closing stays one tap away at every scroll position. */}
      <View style={styles.header}>
        <SheetCloseButton label={t('common.close')} onPress={onClose} />
      </View>
      <Sheet.ScrollView style={styles.container}>
        {isLoading && (
          <View style={styles.loading}>
            <Loader size="small" tone="neutral" />
          </View>
        )}

        {data && (
          <>
            <BuildingHeader building={data.building} />

            {description && (
              <DetailSection title={t('building.buildingInfo')}>
                <BuildingDescription key={sectionKey} description={description} />
              </DetailSection>
            )}

            {data.floors.length > 0 && (
              <DetailSection title={t('building.floorGuide')}>
                <FloorGuide
                  key={sectionKey}
                  skkuId={skkuId}
                  floors={data.floors}
                  connections={data.connections}
                  highlightedFloor={highlightedFloor}
                  highlightSpaceCd={highlightSpaceCd}
                  onConnectionTap={onConnectionTap}
                />
              </DetailSection>
            )}

            {(data.connections.length > 0 || hsscMapName) && (
              <DetailSection title={t('building.connectedBuildings')}>
                {hsscMapName && (
                  <ListRow
                    left={
                      <View style={styles.floorMapIcon}>
                        <MapTrifoldIcon size={20} color={color.fg.brand} />
                      </View>
                    }
                    contents={
                      <ListRow.Texts
                        layout="2RowTypeE"
                        top={t('building.floorMap')}
                        bottom={t('building.floorMapDesc')}
                      />
                    }
                    withArrow
                    verticalPadding="small"
                    onPress={handleFloorMapPress}
                  />
                )}
                {data.connections.length > 0 && (
                  <ConnectionsSection
                    connections={data.connections}
                    onConnectionTap={onConnectionTap}
                  />
                )}
              </DetailSection>
            )}

            <View style={{ height: SHEET_CONTENT_BOTTOM + bottomInset }} />
          </>
        )}
      </Sheet.ScrollView>
    </>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: SdsSpacing.x4,
    paddingBottom: SdsSpacing.x2,
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  loading: {
    padding: SdsSpacing.x10,
    alignItems: 'center',
  },
  sectionDivider: {
    height: SdsSpacing.x2,
    backgroundColor: color.bg.neutralMuted,
    marginTop: SdsSpacing.x5,
  },
  floorMapIcon: {
    width: 40,
    height: 40,
    borderRadius: SdsRadius.r2_5,
    backgroundColor: color.bg.brandWeak,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
