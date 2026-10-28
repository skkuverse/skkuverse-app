import { useCallback, useEffect, useRef } from 'react';
import { track } from '@/platform/analytics';
import type { DispatchOutcome } from '../bridge.rules';
import { bridgeMethodOf, MiniAppSession, type MiniAppLoadOutcome } from '../telemetry.rules';

export function useMiniAppSession(miniAppId: string | undefined) {
  // WHY: a load is sent once its outcome is known; the bridge tally, and a load that never
  // settled, go when the shell closes.
  const session = useRef<MiniAppSession | null>(null);
  useEffect(() => {
    if (!miniAppId) return;
    const s = new MiniAppSession(miniAppId, Date.now());
    session.current = s;
    return () => {
      session.current = null;
      const { load, bridge } = s.close(Date.now());
      if (load) track('miniapp_load', load);
      if (bridge) track('miniapp_bridge', bridge);
    };
  }, [miniAppId]);
  const markLoad = useCallback((outcome: Exclude<MiniAppLoadOutcome, 'abandoned'>, status?: number) => {
    const load = session.current?.load(outcome, Date.now(), status);
    if (load) track('miniapp_load', load);
  }, []);
  const recordBridgeCall = useCallback((data: unknown, outcome: DispatchOutcome) => {
    session.current?.bridge(bridgeMethodOf(data), outcome);
  }, []);

  return { markLoad, recordBridgeCall };
}
