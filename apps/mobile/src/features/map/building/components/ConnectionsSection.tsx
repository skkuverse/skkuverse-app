import { View } from 'react-native';
import {
  getLocalizedText,
  useT,
  SdsRadius,
} from '@skkuverse/shared';
import { ListRow, Txt, createThemedStyles } from '@skkuverse/sds';
import type { BuildingConnection } from '../building.types';
import { useAppLanguage } from '../../useAppLanguage';

function floorOrder(name: string): number {
  const krBasement = name.match(/지하\s*(\d+)/);
  if (krBasement) return -Number(krBasement[1]);
  const enBasement = name.match(/^B(\d+)$/i);
  if (enBasement) return -Number(enBasement[1]);
  const num = name.match(/(\d+)/);
  if (num) return Number(num[1]);
  return 0;
}

interface ConnectionsSectionProps {
  connections: BuildingConnection[];
  onConnectionTap: (targetSkkuId: number) => void;
}

export function ConnectionsSection({
  connections,
  onConnectionTap,
}: ConnectionsSectionProps) {
  const styles = useStyles();
  const lang = useAppLanguage();
  const { t } = useT();

  if (connections.length === 0) return null;

  const grouped = new Map<number, BuildingConnection[]>();
  for (const conn of connections) {
    const list = grouped.get(conn.targetSkkuId) ?? [];
    list.push(conn);
    grouped.set(conn.targetSkkuId, list);
  }

  return (
    <View>
      {Array.from(grouped.entries()).map(([targetSkkuId, group]) => {
        const first = group[0];
        const floorDesc = [...group]
          .sort(
            (a, b) =>
              floorOrder(getLocalizedText(a.fromFloor, lang)) -
              floorOrder(getLocalizedText(b.fromFloor, lang)),
          )
          .map((c) => getLocalizedText(c.fromFloor, lang))
          .join(' · ');

        return (
          <ListRow
            key={targetSkkuId}
            left={
              <View style={styles.connIcon}>
                <Txt
                  typography="t3"
                  fontWeight="bold"
                  color="neutralSubtle"
                >
                  {first.targetDisplayNo ?? ''}
                </Txt>
              </View>
            }
            contents={
              <ListRow.Texts
                layout="2RowTypeE"
                top={getLocalizedText(first.targetName, lang)}
                bottom={`${floorDesc} ${t('building.passageway')}`}
              />
            }
            withArrow
            verticalPadding="small"
            onPress={() => onConnectionTap(targetSkkuId)}
          />
        );
      })}
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  connIcon: {
    width: 40,
    height: 40,
    borderRadius: SdsRadius.r2_5,
    backgroundColor: color.bg.neutralWeak,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
