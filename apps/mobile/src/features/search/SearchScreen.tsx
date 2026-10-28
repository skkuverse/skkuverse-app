import { View, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MagnifyingGlassIcon, MapPinIcon } from 'phosphor-react-native';
import { SdsSpacing, useT, getLocalizedText, floorBadge } from '@skkuverse/shared';
import { ResultSection, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import { CampusFilterControl } from './components/CampusFilterControl';
import { QueryField } from './components/QueryField';
import { ResultFold } from './components/ResultFold';
import { ResultRow } from './components/ResultRow';
import { StationRow } from './components/StationRow';
import { StopRows } from './components/StopRows';
import { dividedSections } from './search.rules';
import { useSearch } from './useSearch';

interface SearchScreenProps {
  listsStops: boolean;
  opensBeneath: boolean;
}

export function SearchScreen({ listsStops, opensBeneath }: SearchScreenProps) {
  const color = useSemanticColors();
  const styles = useStyles();
  const { t, tpl } = useT();
  const insets = useSafeAreaInsets();
  const {
    inputValue,
    debouncedQuery,
    expanded,
    campusFilter,
    campusCounts,
    data,
    stopResults,
    stationResults,
    flatSpaces,
    lang,
    handleTextChange,
    handleClear,
    handleCampusFilterChange,
    handleSectionToggle,
    handleBuildingTap,
    handleStopTap,
    handleStationTap,
    handleSpaceTap,
  } = useSearch({ listsStops, opensBeneath });

  const hasBuildings = data && data.buildings.length > 0;
  const hasStops = stopResults.length > 0;
  const hasStations = stationResults.length > 0;
  const hasSpaces = data && flatSpaces.length > 0;
  const noQuery = debouncedQuery.length === 0;
  const noResults = !noQuery && data && !hasBuildings && !hasStops && !hasStations && !hasSpaces;
  const divided = dividedSections({
    buildings: Boolean(hasBuildings),
    stops: hasStops,
    stations: hasStations,
    spaces: Boolean(hasSpaces),
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <QueryField
        value={inputValue}
        placeholder={t(listsStops ? 'search.placeholderWithStops' : 'search.placeholder')}
        onChangeText={handleTextChange}
        onClear={handleClear}
      />

      <CampusFilterControl value={campusFilter} counts={campusCounts} onChange={handleCampusFilterChange} />

      {noQuery && (
        <ResultSection
          size="medium"
          asset={<MapPinIcon size={SdsSpacing.x10} color={color.fg.disabled} weight="thin" />}
          description={t('search.emptyPrompt')}
        />
      )}

      {noResults && (
        <ResultSection
          size="medium"
          asset={<MagnifyingGlassIcon size={SdsSpacing.x10} color={color.fg.disabled} />}
          title={tpl('search.noResult', debouncedQuery)}
          description={t('search.noResultHint')}
        />
      )}

      {!noQuery && !noResults && (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          bounces={false}
          contentContainerStyle={styles.list}
        >
          {hasBuildings && (
            <ResultFold
              title={t('building.building')}
              count={data.buildingCount}
              expanded={expanded.buildings}
              onToggle={() => handleSectionToggle('buildings')}
            >
              {data.buildings.map((building) => (
                <ResultRow
                  key={building.skkuId}
                  mark={building.displayNo ?? '#'}
                  title={getLocalizedText(building.name, lang)}
                  subtitle={building.campusLabel}
                  onPress={() => handleBuildingTap(building)}
                />
              ))}
            </ResultFold>
          )}

          {hasStops && (
            <ResultFold
              divided={divided.stops}
              title={t('search.stop')}
              count={stopResults.length}
              expanded={expanded.stops}
              onToggle={() => handleSectionToggle('stops')}
            >
              {stopResults.map((result) => (
                <StopRows key={result.key} stop={result} onPolePress={(pole) => handleStopTap(result, pole)} />
              ))}
            </ResultFold>
          )}

          {hasStations && (
            <ResultFold
              divided={divided.stations}
              title={t('search.station')}
              count={stationResults.length}
              expanded={expanded.stations}
              onToggle={() => handleSectionToggle('stations')}
            >
              {stationResults.map((station) => (
                <StationRow key={station.id} station={station} onPress={() => handleStationTap(station)} />
              ))}
            </ResultFold>
          )}

          {hasSpaces && (
            <ResultFold
              divided={divided.spaces}
              title={t('building.space')}
              count={data.spaceCount}
              expanded={expanded.spaces}
              onToggle={() => handleSectionToggle('spaces')}
            >
              {flatSpaces.map((space, i) => (
                <ResultRow
                  key={`${space.group.buildNo}-${space.spaceCd}-${i}`}
                  mark={floorBadge(getLocalizedText(space.floor, lang))}
                  title={getLocalizedText(space.name, lang)}
                  subtitle={getLocalizedText(space.group.buildingName, lang)}
                  code={space.spaceCd}
                  onPress={() =>
                    handleSpaceTap(
                      space.group,
                      space.spaceCd,
                      space.floor.ko,
                    )
                  }
                />
              ))}
            </ResultFold>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
  list: {
    paddingBottom: SdsSpacing.x10,
  },
}));
