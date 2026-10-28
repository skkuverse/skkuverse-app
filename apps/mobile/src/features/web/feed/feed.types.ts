import type { ActionType } from '@skkuverse/shared';
import type { MiniAppFeedEntry } from '../web.types';

export type MiniAppFeedAge =
  | { kind: 'justNow' }
  | { kind: 'minutes'; value: number }
  | { kind: 'hours'; value: number }
  | { kind: 'date'; month: number; day: number };

export interface MiniAppFeedOpenAction {
  kind: 'action';
  actionType: Exclude<ActionType, 'unknown'>;
  actionValue: string;
}

export type MiniAppFeedAction = { kind: 'list' } | MiniAppFeedOpenAction;

export interface MiniAppFeedScreenRow {
  entry: MiniAppFeedEntry;
  timeText: string;
  action: MiniAppFeedOpenAction | null;
}

export interface MiniAppFeedPressableRow {
  entry: MiniAppFeedEntry;
  timeText: string;
  onPress?: () => void;
}

export interface MiniAppFeedPush {
  miniAppId: string;
  entryId: string | null;
}

export type MiniAppFeedSectionCard =
  | { kind: 'askPush'; title: string; body: string; a11yLabel: string }
  | {
      kind: 'latest';
      entryId: string;
      title: string;
      body: string;
      a11yLabel: string;
      fresh: boolean;
      action: MiniAppFeedAction;
    }
  | { kind: 'empty'; body: string; a11yLabel: string };
