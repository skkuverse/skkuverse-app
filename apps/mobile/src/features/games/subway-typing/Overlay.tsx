import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT, SdsSpacing } from '@skkuverse/shared';
import type { StageProps } from '../games.types';
import { FIRST_PARTY_GAMES } from '../registry.rules';
import { StageTitle } from '../components/StageTitle';
import { useSemanticColors } from '@skkuverse/sds';

/**
 * CONTRACT(skkuverse-mini): skkuverse-mini/games/subway-typing/src/layout.ts holds the same CHROME_HEIGHT and
 * TITLE_HEIGHT, in points below the top inset.
 */
const CHROME_HEIGHT = 56;
const TITLE_HEIGHT = 136;

const { format } = FIRST_PARTY_GAMES['subway-typing'].score;

/**
 * QUIRK(ios): only a tap inside the page raises the keyboard, so the page draws its own start button and the
 * overlay draws the title alone.
 */
export function Overlay({ phase, hi }: StageProps) {
  const color = useSemanticColors();
  const { t, tpl } = useT();
  const insets = useSafeAreaInsets();
  if (phase !== 'ready') return null;
  return (
    <View pointerEvents="none" style={[styles.title, { top: insets.top + CHROME_HEIGHT, height: TITLE_HEIGHT }]}>
      <StageTitle
        title={t('game.subwayTyping.stageTitle')}
        sub={t('game.subwayTyping.sub')}
        best={hi > 0 ? tpl('game.best', format(hi)) : undefined}
        ink={color.fg.neutral}
        softInk={color.fg.neutralSubtle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { position: 'absolute', left: 0, right: 0, justifyContent: 'center', paddingHorizontal: SdsSpacing.x6 },
});
