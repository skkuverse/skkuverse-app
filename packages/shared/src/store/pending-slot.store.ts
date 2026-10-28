/** WHY: the owner passes its dev log, which the shared package cannot import. */
export type PendingSlotLog = (event: string, data: Record<string, unknown>) => void;

export interface PendingSlotOptions<T> {
  name: string;
  log?: PendingSlotLog;
  /** WHY: never a user's data. */
  describe?: (value: T) => Record<string, unknown>;
}

export interface PendingSlot<T> {
  set: (value: T) => void;
  /**
   * WHY: read and clear in one call, so a value is acted on once; a value `accept` refuses stays for
   * another consumer.
   */
  consume: (accept?: (value: T) => boolean) => T | null;
  subscribe: (listener: () => void) => () => void;
}

export function createPendingSlot<T>({ name, log, describe }: PendingSlotOptions<T>): PendingSlot<T> {
  // WHY: a box, since `T` may itself be a falsy value, so "empty" is its own state.
  let pending: { value: T } | null = null;
  const listeners = new Set<() => void>();
  return {
    set(value) {
      pending = { value };
      log?.(`${name}.set`, { ...describe?.(value), listenerCount: listeners.size });
      listeners.forEach((listener) => {
        listener();
      });
    },
    consume(accept) {
      // WHY: no log when empty: every subscriber drains on every mount and every set.
      if (!pending) return null;
      const { value } = pending;
      if (accept && !accept(value)) {
        log?.(`${name}.consume`, { ...describe?.(value), outcome: 'refused' });
        return null;
      }
      pending = null;
      log?.(`${name}.consume`, { ...describe?.(value), outcome: 'taken' });
      return value;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
