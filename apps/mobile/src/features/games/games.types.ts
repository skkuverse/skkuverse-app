import type { GameRect, GameStats } from '@skkuverse/miniapp/protocol';
import type { TranslationKey } from '@skkuverse/shared';
import type { GameOver, SessionState } from './host/host.rules';
import type { ScoreOrder } from './leaderboard.rules';

export type Translate = (key: TranslationKey, ...args: (string | number)[]) => string;

export interface StageProps {
  phase: SessionState['phase'];
  hi: number;
  showControls: boolean;
  /** WHY: in CSS px of a full-screen web view, so in points from the screen's top left; null until the page reports. */
  rect: GameRect | null;
}

export interface ScoreSpec {
  /** WHY: a distance is `desc`, a time is `asc`; compare through `isBetter`, never a bare `>`. */
  order: ScoreOrder;
  format(score: number): string;
  /** WHY: none for a time, which reads without a unit. */
  unitKey?: TranslationKey;
}

/** WHY: the validator a result is scored by is the one the page names in `game.over`. */
export interface LeaderboardSpec {
  maxEntry: number;
}

export interface ResultDetail {
  labelKey: TranslationKey;
  value: string;
}

export interface FirstPartyGame {
  titleKey: TranslationKey;
  headline(over: GameOver): TranslationKey;
  score: ScoreSpec;
  /**
   * WHY: a game is ranked exactly when this is set. Null means played for the device best only: no run is
   * stamped, nothing is submitted, and it has no board anywhere.
   */
  leaderboard: LeaderboardSpec | null;
  details?(stats: GameStats, tpl: Translate): ResultDetail[];
  /** WHY: without it no ad is ever loaded. */
  revives: boolean;
  /**
   * WHY: Android BACK mid-run pauses such a game; one without a pause is left at once, the run given up, as the X
   * does.
   */
  pauses: boolean;
  /**
   * WHY: the web view lets the page's input raise the keyboard; the page starts its own run, since iOS raises it
   * only inside a tap.
   */
  keyboard: boolean;
  sound: boolean;
  background: string;
  scrim: string;
  homeEmoji: string;
}

/**
 * WHY: only `id` makes an entry; any field this build cannot read takes the value that hides the game, never one
 * that opens it.
 */
export interface GameRegistryEntry {
  id: string;
  entryUrl: string | null;
  enabled: boolean;
  minHostProtocol: number | null;
}

/**
 * WHY: only `hosted` opens (ADR 0021 decision 5). `hidden` (disabled or too new) and `unknown` (unlisted,
 * or the registry unreachable with nothing cached) open nothing, and links land on home.
 */
export type GameExposure = { kind: 'hosted'; entryUrl: string } | { kind: 'hidden' } | { kind: 'unknown' };

/** WHY: `origin` is the one `games.origins` maps to this id, which the host hears and speaks to alone. */
export type GamePage = { kind: 'hosted'; entryUrl: string; origin: string };
