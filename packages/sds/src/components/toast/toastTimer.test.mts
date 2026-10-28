// A toast shows 3 s, or 5 s with an action, and stops counting while touched
// (TOAST-05), driven on a fake clock.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { SdsDuration } from '../../../../shared/src/tokens/duration.ts';
import { startToastTimer, toastDisplayMs, type ToastClock } from './toastTimer.ts';

/** A clock that moves only when told to, firing what falls due. */
function fakeClock() {
  let time = 0;
  let next = 1;
  const pending = new Map<number, { at: number; callback: () => void }>();
  const clock: ToastClock & { advance(ms: number): void } = {
    now: () => time,
    setTimeout(callback, ms) {
      const id = next++;
      pending.set(id, { at: time + ms, callback });
      return id;
    },
    clearTimeout(handle) {
      pending.delete(handle as number);
    },
    advance(ms) {
      const until = time + ms;
      for (;;) {
        const due = [...pending.entries()].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        pending.delete(due[0]);
        time = due[1].at;
        due[1].callback();
      }
      time = until;
    },
  };
  return clock;
}

describe('toastDisplayMs', () => {
  it('is 3 s, or 5 s with an action', () => {
    assert.equal(toastDisplayMs(SdsDuration, false), 3000);
    assert.equal(toastDisplayMs(SdsDuration, true), 5000);
  });
});

describe('startToastTimer', () => {
  it('closes when the time runs out', () => {
    const clock = fakeClock();
    let closedAt: number | null = null;
    startToastTimer(3000, () => (closedAt = clock.now()), clock);
    clock.advance(2999);
    assert.equal(closedAt, null);
    clock.advance(1);
    assert.equal(closedAt, 3000);
  });

  it('stays while touched and leaves 5 s after it was shown, excluding the touched time', () => {
    const clock = fakeClock();
    let closedAt: number | null = null;
    const timer = startToastTimer(5000, () => (closedAt = clock.now()), clock);
    clock.advance(1000);
    timer.pause();
    clock.advance(10_000);
    assert.equal(closedAt, null, 'a held toast never leaves');
    timer.resume();
    clock.advance(3999);
    assert.equal(closedAt, null);
    clock.advance(1);
    assert.equal(closedAt, 15_000);
  });

  it('ignores a repeated pause or resume, and never fires once cancelled', () => {
    const clock = fakeClock();
    let fired = 0;
    const timer = startToastTimer(3000, () => fired++, clock);
    timer.resume();
    timer.pause();
    timer.pause();
    clock.advance(5000);
    timer.resume();
    timer.resume();
    clock.advance(3000);
    assert.equal(fired, 1);

    const cancelled = startToastTimer(3000, () => fired++, clock);
    cancelled.cancel();
    cancelled.resume();
    clock.advance(10_000);
    assert.equal(fired, 1);
  });
});
