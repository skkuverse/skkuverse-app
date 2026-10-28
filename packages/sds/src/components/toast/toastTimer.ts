/** WHY: the clock is passed in, so `node --test` drives the timer on a fake one. */
export interface ToastClock {
  now(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export function toastDisplayMs(durations: { toast: number; toastWithAction: number }, hasAction: boolean): number {
  return hasAction ? durations.toastWithAction : durations.toast;
}

export interface ToastTimer {
  pause(): void;
  resume(): void;
  cancel(): void;
}

export function startToastTimer(totalMs: number, onElapsed: () => void, clock: ToastClock): ToastTimer {
  let remaining = totalMs;
  let startedAt = clock.now();
  let handle: unknown = clock.setTimeout(fire, remaining);
  let state: 'running' | 'paused' | 'done' = 'running';

  function fire() {
    state = 'done';
    handle = undefined;
    onElapsed();
  }

  return {
    pause() {
      if (state !== 'running') return;
      clock.clearTimeout(handle);
      handle = undefined;
      remaining = Math.max(0, remaining - (clock.now() - startedAt));
      state = 'paused';
    },
    resume() {
      if (state !== 'paused') return;
      startedAt = clock.now();
      handle = clock.setTimeout(fire, remaining);
      state = 'running';
    },
    cancel() {
      if (handle !== undefined) clock.clearTimeout(handle);
      handle = undefined;
      state = 'done';
    },
  };
}
