export interface CancellableFunction<This, Args extends unknown[]> {
  (this: This, ...args: Args): void;
  cancel(): void;
}

interface PendingCall<This, Args extends unknown[]> {
  context: This;
  args: Args;
}

function validateWait(waitMs: number): void {
  if (!Number.isFinite(waitMs) || waitMs < 0 || waitMs > 2147483647) {
    throw new RangeError('Timer delay must be between 0 and 2147483647 milliseconds');
  }
}

/** Trailing-edge debounce. Cancellation also releases retained arguments and this. */
export function debounce<This, Args extends unknown[]>(
  callback: (this: This, ...args: Args) => unknown,
  waitMs: number,
): CancellableFunction<This, Args> {
  validateWait(waitMs);
  let timer: number | undefined;
  let pending: PendingCall<This, Args> | undefined;

  function debounced(this: This, ...args: Args): void {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    pending = { context: this, args };
    timer = setTimeout(() => {
      timer = undefined;
      const call = pending;
      pending = undefined;
      if (call !== undefined) callback.apply(call.context, call.args);
    }, waitMs);
  }
  debounced.cancel = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    pending = undefined;
  };
  return debounced;
}

/** Leading + trailing throttle; the trailing call uses the latest context and arguments. */
export function throttle<This, Args extends unknown[]>(
  callback: (this: This, ...args: Args) => unknown,
  waitMs: number,
): CancellableFunction<This, Args> {
  validateWait(waitMs);
  let timer: number | undefined;
  let pending: PendingCall<This, Args> | undefined;

  function onInterval(): void {
    timer = undefined;
    const call = pending;
    pending = undefined;
    if (call === undefined) return;
    timer = setTimeout(onInterval, waitMs);
    callback.apply(call.context, call.args);
  }

  function throttled(this: This, ...args: Args): void {
    if (timer !== undefined) {
      pending = { context: this, args };
      return;
    }
    timer = setTimeout(onInterval, waitMs);
    callback.apply(this, args);
  }
  throttled.cancel = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    pending = undefined;
  };
  return throttled;
}
