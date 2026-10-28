import { parseMessage } from '@skkuverse/miniapp/protocol';
import type { DispatchOutcome } from './bridge.rules';

/**
 * WHY: `ready` means the page called `app.ready`; `load_end` that the document loaded without calling it;
 * `abandoned` that the shell closed first. The rest are the WebView's failure callbacks.
 */
export type MiniAppLoadOutcome = 'ready' | 'load_end' | 'error' | 'http_error' | 'terminated' | 'abandoned';

// WHY: a type alias, since an interface has no implicit index signature and track takes a record.
export type MiniAppLoadParams = {
  miniapp_id: string;
  outcome: MiniAppLoadOutcome;
  ms: number;
  status?: number;
};

/** EVIDENCE: eight methods plus three fixed keys stay far inside GA4's event parameter budget. */
export type MiniAppBridgeParams = { miniapp_id: string; calls: number; rejected: number } & {
  [method: `m_${string}`]: number;
};

export function bridgeMethodOf(data: unknown): string | null {
  return parseMessage(data)?.method ?? null;
}

const methodKey = (method: string) => `m_${method.replace(/[^a-zA-Z0-9]/g, '_')}` as const;

export class MiniAppSession {
  private readonly miniAppId: string;
  private readonly openedAt: number;
  private loadEndMs: number | null = null;
  private settled = false;
  private calls = 0;
  private rejected = 0;
  private readonly handled = new Map<string, number>();

  constructor(miniAppId: string, now: number) {
    this.miniAppId = miniAppId;
    this.openedAt = now;
  }

  /**
   * WHY: a later navigation inside the page never reports a second load; `load_end` only notes the time, so a late
   * `app.ready` still wins.
   */
  load(outcome: Exclude<MiniAppLoadOutcome, 'abandoned'>, now: number, status?: number): MiniAppLoadParams | null {
    if (this.settled) return null;
    if (outcome === 'load_end') {
      this.loadEndMs ??= now - this.openedAt;
      return null;
    }
    this.settled = true;
    return { miniapp_id: this.miniAppId, outcome, ms: now - this.openedAt, status };
  }

  bridge(method: string | null, outcome: DispatchOutcome): void {
    this.calls++;
    if (outcome !== 'handled' || method === null) {
      this.rejected++;
      return;
    }
    this.handled.set(method, (this.handled.get(method) ?? 0) + 1);
  }

  close(now: number): { load: MiniAppLoadParams | null; bridge: MiniAppBridgeParams | null } {
    let load: MiniAppLoadParams | null = null;
    if (!this.settled) {
      this.settled = true;
      load =
        this.loadEndMs === null
          ? { miniapp_id: this.miniAppId, outcome: 'abandoned', ms: now - this.openedAt }
          : { miniapp_id: this.miniAppId, outcome: 'load_end', ms: this.loadEndMs };
    }
    let bridge: MiniAppBridgeParams | null = null;
    if (this.calls > 0) {
      bridge = { miniapp_id: this.miniAppId, calls: this.calls, rejected: this.rejected };
      for (const [method, n] of this.handled) bridge[methodKey(method)] = n;
    }
    return { load, bridge };
  }
}
