import * as Haptics from 'expo-haptics';
import type { WebToAppMessage } from '@skkuverse/bridge';
import type { GameHapticStyle } from '@skkuverse/miniapp/protocol';

type HapticStyle = Extract<WebToAppMessage, { type: 'web:haptic' }>['style'];

const IMPACT: Record<HapticStyle, Haptics.ImpactFeedbackStyle> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
};

/** WHY: a failure is swallowed: a device without a haptic engine loses the feel, never the page. */
export function playWebHaptic(style: HapticStyle): void {
  void Haptics.impactAsync(IMPACT[style]).catch(() => {});
}

export function playSelectionTick(): void {
  void Haptics.selectionAsync().catch(() => {});
}

/** WHY: its own map, not `web:haptic`'s: that bridge is vendored into skkuverse-web and has no `error`. */
const GAME_IMPACT: Record<Exclude<GameHapticStyle, 'success'>, Haptics.ImpactFeedbackStyle> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
  soft: Haptics.ImpactFeedbackStyle.Soft,
  rigid: Haptics.ImpactFeedbackStyle.Rigid,
  // WHY: short and hard; a slip can come every few keys, and the notification
  // pattern would still be buzzing at the next one.
  error: Haptics.ImpactFeedbackStyle.Rigid,
};

export function playGameHaptic(style: GameHapticStyle): void {
  const done =
    style === 'success'
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : Haptics.impactAsync(GAME_IMPACT[style]);
  void done.catch(() => {});
}
