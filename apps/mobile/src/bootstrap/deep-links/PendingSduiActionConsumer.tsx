import { useEffect } from 'react';
import { useRootNavigationState } from 'expo-router';
import { handleSduiAction, pendingSduiAction } from '@/features/web/web.service';

// QUIRK(expo-router): a push before the root navigator has a key is silently lost, and a quit-state tap can resolve that early.
export function PendingSduiActionConsumer() {
  const navState = useRootNavigationState();

  useEffect(() => {
    if (!navState?.key) return;

    const tryConsume = () => {
      const p = pendingSduiAction.consume();
      if (!p) return;
      // WHY: a frame later, so a tab activation that came with the tap commits before the push.
      requestAnimationFrame(() => {
        handleSduiAction({ actionType: p.actionType, actionValue: p.actionValue, source: 'push' });
      });
    };

    tryConsume();
    return pendingSduiAction.subscribe(tryConsume);
  }, [navState?.key]);

  return null;
}
