import { useEffect, useState } from 'react';
import { subscribeForeground } from '@/platform/clock';
import { resumedAt } from '../marker-geometry.rules';

export function useResumedAt(nowMs: number): number {
  const [foregroundAtMs, setForegroundAtMs] = useState(() => Date.now());
  useEffect(() => subscribeForeground(() => setForegroundAtMs(Date.now())), []);
  const [clock, setClock] = useState({ lastTickMs: nowMs, resumedAtMs: foregroundAtMs });
  // WHY: adjusted while rendering, so the frame the clock resumes in already knows it came back.
  if (clock.lastTickMs !== nowMs) {
    const next = resumedAt({ foregroundAtMs: clock.resumedAtMs, lastTickMs: clock.lastTickMs, nowMs });
    setClock({ lastTickMs: nowMs, resumedAtMs: next });
  }
  return Math.max(foregroundAtMs, clock.resumedAtMs);
}
