export type PreUnregister = {
  landed: () => Promise<void>;
  issued: () => Promise<void>;
  abort: () => void;
};

// WHY: started, not awaited, since a Firestore write settles only on server ack and offline the sheet
// would never open. Not merely bounded: a write queued under an old uid is never sent once the uid
// changes, leaving the doc active under nobody and the new uid's claim denied for good.
export function startPreUnregister(opts: {
  run: (signal: AbortSignal, onIssued: () => void) => Promise<void>;
  timeoutMs: number;
  onLandTimeout: () => void;
}): PreUnregister {
  const controller = new AbortController();
  let markIssued: () => void = () => {};
  const issuedSignal = new Promise<void>((resolve) => {
    markIssued = resolve;
  });
  // WHY: failures are the run's to log, since phase A never fails sign-in; a run that ends without
  // issuing also releases `issued()`.
  const done = opts.run(controller.signal, markIssued).then(
    () => undefined,
    () => undefined,
  );
  done.then(markIssued);
  // WHY: once aborted the write can no longer be issued, so nothing is left for `issued()` to wait on.
  const stop = () => {
    controller.abort();
    markIssued();
  };

  const within = async (work: Promise<void>): Promise<boolean> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const bound = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), opts.timeoutMs);
    });
    const inTime = await Promise.race([work.then(() => true), bound]);
    clearTimeout(timer);
    if (!inTime) stop();
    return inTime;
  };

  let landed: Promise<void> | null = null;
  let issued: Promise<void> | null = null;
  return {
    // WHY: before a uid change it waits for the server ack; a timeout is reported, as the doc may be stranded.
    landed: () =>
      (landed ??= within(done).then((inTime) => {
        if (!inTime) opts.onLandTimeout();
      })),
    // WHY: with the uid kept, queued ahead of the re-register is enough (one uid's queue sends in order);
    // past its bound it aborts, since a write waiting on App Check must never issue behind the re-register.
    issued: () => (issued ??= within(issuedSignal).then(() => undefined)),
    abort: stop,
  };
}

export const NO_PRE_UNREGISTER: PreUnregister = {
  landed: async () => {},
  issued: async () => {},
  abort: () => {},
};
