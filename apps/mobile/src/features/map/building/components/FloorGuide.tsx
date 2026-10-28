import { useState, useMemo } from 'react';
import { View } from 'react-native';
import { SdsSpacing, getLocalizedText, useT } from '@skkuverse/shared';
import { AccordionList, Badge, Chip, Txt, createThemedStyles } from '@skkuverse/sds';
import { logFloorExpand, logSpaceShowAll } from '@/platform/analytics';
import type { BuildingConnection, FloorInfo } from '../building.types';
import { useAppLanguage } from '../../useAppLanguage';
import { toChipsByFloorBadge, toFloorSections } from './floor-guide.rules';

interface FloorGuideProps {
  skkuId: number;
  floors: FloorInfo[];
  connections: BuildingConnection[];
  highlightedFloor: number | null;
  highlightSpaceCd?: string;
  onConnectionTap: (targetSkkuId: number) => void;
}

export function FloorGuide({
  skkuId,
  floors,
  connections,
  highlightedFloor,
  highlightSpaceCd,
  onConnectionTap,
}: FloorGuideProps) {
  const styles = useStyles();
  const lang = useAppLanguage();
  const { tpl } = useT();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(highlightedFloor);
  const [showAllMap, setShowAllMap] = useState<Record<number, boolean>>({});

  const sections = useMemo(() => toFloorSections(floors, lang, tpl), [floors, lang, tpl]);
  const chipsByFloorBadge = useMemo(() => toChipsByFloorBadge(connections, lang), [connections, lang]);

  return (
    <AccordionList
      sections={sections}
      expandedIndex={expandedIndex}
      onToggle={(i) => {
        setExpandedIndex(i);
        if (i != null) {
          const floorName = sections[i]?.title ?? '';
          logFloorExpand(skkuId, floorName);
        }
      }}
      showAllMap={showAllMap}
      accentColor="brand"
      onShowAll={(i) => {
        setShowAllMap((prev) => ({ ...prev, [i]: true }));
        const floorName = sections[i]?.title ?? '';
        logSpaceShowAll(skkuId, floorName);
      }}
      keyExtractor={(space) => space.spaceCd}
      highlightKey={highlightSpaceCd}
      renderRight={(section) => {
        const chips = chipsByFloorBadge[section.badge ?? ''];
        if (!chips) return null;
        return (
          <View style={styles.connChipRow}>
            {chips.map((chip) => (
              <Chip.Button
                key={chip.targetSkkuId}
                size="small"
                onPress={() => onConnectionTap(chip.targetSkkuId)}
              >
                <Chip.Label>{'→ ' + chip.label}</Chip.Label>
              </Chip.Button>
            ))}
          </View>
        );
      }}
      renderItem={(space, _i, highlighted) => (
        <View
          style={[
            styles.spaceRow,
            highlighted && styles.spaceHighlight,
          ]}
        >
          <Txt
            typography="t3"
            fontWeight={highlighted ? 'medium' : 'regular'}
            color={highlighted ? 'brand' : 'neutralMuted'}
            style={styles.spaceName}
          >
            {getLocalizedText(space.name, lang)}
          </Txt>
          <Badge
            size="xsmall"
            color={highlighted ? 'brand' : 'placeholder'}
            backgroundColor={highlighted ? 'brandWeak' : 'neutralWeak'}
            style={{ minWidth: 64 }}
          >
            {space.spaceCd}
          </Badge>
        </View>
      )}
    />
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  spaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SdsSpacing.x2_5,
  },
  spaceHighlight: {
    backgroundColor: color.bg.brandWeak,
  },
  spaceName: {
    flex: 1,
  },
  connChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SdsSpacing.x1_5,
  },
}));
