import { StyleSheet, View } from 'react-native';
import { Tossface, Txt } from '@skkuverse/sds';
import { useT, SdsSpacing } from '@skkuverse/shared';
import type { GameId } from '../../games.constants';
import { FIRST_PARTY_GAMES } from '../../registry.rules';

// eslint-disable-next-line sds/no-handbuilt-part -- not a chip: a board's static heading (emoji and game name), with nothing to pick or press
export function GameChip({ gameId }: { gameId: GameId }) {
  const { t } = useT();
  const game = FIRST_PARTY_GAMES[gameId];
  return (
    <View style={styles.chip}>
      <Tossface size={18}>{game.homeEmoji}</Tossface>
      <Txt typography="t5" fontWeight="bold" color="neutral">
        {t(game.titleKey)}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: SdsSpacing.x1_5 },
});
