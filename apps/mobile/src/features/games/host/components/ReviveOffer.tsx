import { useT } from '@skkuverse/shared';
import { DrainButton } from './DrainButton';

export const REVIVE_WINDOW_MS = 10_000;

interface Props {
  offer: 'open' | 'watching' | 'closed';
  enabled: boolean;
  paused: boolean;
  onRevive(): void;
  onExpire(): void;
}

/** WHY: the button runs out on its own, so the player never has to decline it. */
export function ReviveOffer({ offer, enabled, paused, onRevive, onExpire }: Props) {
  const { t } = useT();
  return (
    <DrainButton
      label={t('game.revive')}
      durationMs={REVIVE_WINDOW_MS}
      running={offer === 'open' && !paused}
      done={offer === 'closed'}
      enabled={enabled}
      busy={offer === 'watching'}
      onPress={onRevive}
      onExpire={onExpire}
    />
  );
}
