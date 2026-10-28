import { useState } from 'react';
import { addClockSample, clockOffsetOf } from '../server-clock.rules';

export function useServerClockOffset(serverNowMs: number | undefined, receivedAtMs: number): number {
  const [seen, setSeen] = useState<{ receivedAtMs: number; samples: readonly number[] }>({
    receivedAtMs: 0,
    samples: [],
  });
  // WHY: adjusted while rendering, so the frame that brings the poll reads its offset.
  if (serverNowMs !== undefined && receivedAtMs !== seen.receivedAtMs) {
    setSeen({ receivedAtMs, samples: addClockSample(seen.samples, serverNowMs - receivedAtMs) });
  }
  return clockOffsetOf(seen.samples);
}
