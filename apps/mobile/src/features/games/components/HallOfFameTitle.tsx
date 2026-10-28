import { Tossface } from '@skkuverse/sds';
import { SdsTypeScale, useT } from '@skkuverse/shared';

export function HallOfFameTitle({ typography }: { typography: 't9' | 't7' }) {
  const { t } = useT();
  return (
    <Tossface
      size={SdsTypeScale[typography].fontSize}
      // QUIRK(tossface): the glyph sits high in its em box, so the step's line height keeps it level with the row.
      style={{ lineHeight: SdsTypeScale[typography].lineHeight }}
      accessibilityRole="header"
      accessibilityLabel={t('game.hallOfFame')}
    >
      {'\u{1F3C6}'}
    </Tossface>
  );
}
