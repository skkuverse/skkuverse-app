/**
 * WHY: write() runs first, always: a write settles on server ack, so seeding first hangs in a dead spot
 * and loses the change silently. The seed error is not rethrown, the write error matters more, so
 * `onEnsureError` is its only log. Import-free, so a node test covers it.
 */
export async function writeWithSelfHeal<T>({
  write,
  ensure,
  isRecoverable,
  onEnsureError,
}: {
  write: () => Promise<T>;
  ensure: () => Promise<unknown>;
  isRecoverable: (err: unknown) => boolean;
  onEnsureError?: (err: unknown) => void;
}): Promise<T> {
  try {
    return await write();
  } catch (writeErr) {
    if (!isRecoverable(writeErr)) throw writeErr;

    try {
      await ensure();
    } catch (ensureErr) {
      onEnsureError?.(ensureErr);
      throw writeErr;
    }

    // WHY: retry once; a second failure is the truthful error, since the document now exists.
    return await write();
  }
}
