
export const CLOCK_SAMPLES = 5;

export function addClockSample(samples: readonly number[], sample: number): number[] {
  return [...samples, sample].slice(-CLOCK_SAMPLES);
}

/**
 * WHY: a sample only ever reads low (transit time, or a cached response), so the largest sample is the best estimate.
 */
export function clockOffsetOf(samples: readonly number[]): number {
  return samples.length === 0 ? 0 : Math.max(...samples);
}

/**
 * QUIRK(react-native): a response the device HTTP cache replays carries the `serverNow` of the one it copies,
 * so it arrived when that one did; stamping it with the replay's time reads the offset low by up to `max-age`.
 */
export function receiptOf(
  held: { serverNowMs?: number; receivedAtMs: number } | undefined,
  serverNowMs: number | undefined,
  nowMs: number,
): number {
  return held && serverNowMs !== undefined && held.serverNowMs === serverNowMs ? held.receivedAtMs : nowMs;
}
