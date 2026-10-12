import { createStore, type ReadableStore } from './store';

export interface FeedbackOptions {
  /** Acknowledgment is immediate; show a loading indicator after this delay. Default 150. */
  delayMs?: number;
  /** Offer more helpful feedback after this delay. Default 2500. */
  slowMs?: number;
  /** Abort locally after this duration. Disabled by default. Does not undo server work. */
  timeoutMs?: number;
}

export interface TaskOptions<T> extends FeedbackOptions {
  initialData?: T;
  /** Acknowledge immediately, but wait for input to settle before starting work. Default 0. */
  debounceMs?: number;
  /** Latest intent wins for reads. Single rejects overlapping calls with a busy result. */
  concurrency?: 'latest' | 'single';
}

export interface TaskContext {
  signal: AbortSignal;
  id: number;
}
export type Operation<I, T> = (
  input: I,
  context: TaskContext,
) => T | PromiseLike<T>;

export interface TaskSnapshot<I, T> {
  readonly status: 'idle' | 'pending' | 'success' | 'error';
  readonly input: I | undefined;
  /** Last successful data stays available during loading and after a failure. */
  readonly data: T | undefined;
  readonly error: unknown;
  readonly isPending: boolean;
  /** Pending intent whose operation has not started yet. */
  readonly isScheduled: boolean;
  readonly showPending: boolean;
  readonly isSlow: boolean;
}

export type TaskResult<T> =
  | { status: 'success'; data: T }
  | { status: 'error'; error: unknown }
  | { status: 'superseded' | 'cancelled' | 'busy' | 'disposed' | 'idle' };

export interface Task<I, T> extends ReadableStore<TaskSnapshot<I, T>> {
  /** Operation failures are explicit results, never unhandled promise rejections. */
  run(input: I): Promise<TaskResult<T>>;
  /** Explicit retry only. Returns idle before the first run. */
  retry(): Promise<TaskResult<T>>;
  /** Start the latest scheduled operation now. Does nothing once work has started. */
  flush(): void;
  cancel(): void;
  reset(): void;
  dispose(): void;
}

export class TimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`The operation exceeded ${timeoutMs}ms.`);
    this.name = 'TimeoutError';
  }
}

export function validateFeedback(options: FeedbackOptions) {
  for (const [name, value] of Object.entries(options)) {
    if (
      ['delayMs', 'slowMs', 'timeoutMs', 'debounceMs'].includes(name) &&
      value !== undefined &&
      (typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 2_147_483_647)
    ) {
      throw new RangeError(
        `${name} must be a finite, non-negative timer duration.`,
      );
    }
  }
}

/** Coordinates intent and feedback. Does not own caching, routing, or server transactions. */
export function createTask<I, T>(
  operation: Operation<I, T>,
  options: TaskOptions<T> = {},
): Task<I, T> {
  validateFeedback(options);
  const delay = options.delayMs ?? 150;
  const slow = options.slowMs ?? 2500;
  const debounce = options.debounceMs ?? 0;
  const timeout = options.timeoutMs;
  const concurrency = options.concurrency ?? 'latest';
  const initial: TaskSnapshot<I, T> = {
    status: 'idle',
    input: undefined,
    data: options.initialData,
    error: undefined,
    isPending: false,
    isScheduled: false,
    showPending: false,
    isSlow: false,
  };
  const store = createStore(initial);
  type Flight = {
    id: number;
    controller: AbortController;
    timers: ReturnType<typeof setTimeout>[];
    resolve: (result: TaskResult<T>) => void;
    start: () => void;
  };
  let active: Flight | undefined;
  let sequence = 0;
  let disposed = false;
  let previous: { input: I } | undefined;

  const clear = (flight: Flight) => {
    flight.timers.forEach(clearTimeout);
  };

  function detach(reason: 'cancelled' | 'superseded') {
    if (!active) return;
    const flight = active;
    active = undefined;
    clear(flight);
    flight.resolve({ status: reason });
    return flight;
  }

  function cancel() {
    if (!active) return;
    const flight = detach('cancelled');
    store.set({
      ...store.getSnapshot(),
      status: 'idle',
      error: undefined,
      isPending: false,
      isScheduled: false,
      showPending: false,
      isSlow: false,
    });
    // Abort listeners may synchronously start new work. Publish first so that
    // their newer intent cannot be overwritten by this cancellation.
    flight?.controller.abort('cancelled');
  }

  function run(input: I): Promise<TaskResult<T>> {
    if (disposed) return Promise.resolve({ status: 'disposed' });
    if (active && concurrency === 'single')
      return Promise.resolve({ status: 'busy' });
    const superseded = detach('superseded');
    previous = { input };
    let resolve!: Flight['resolve'];
    const promise = new Promise<TaskResult<T>>((done) => {
      resolve = done;
    });
    const flight: Flight = {
      id: ++sequence,
      controller: new AbortController(),
      timers: [],
      resolve,
      start: () => {},
    };
    active = flight;

    function settle(
      result:
        { status: 'success'; data: T } | { status: 'error'; error: unknown },
    ) {
      if (active !== flight) return;
      active = undefined;
      clear(flight);
      const next = {
        ...store.getSnapshot(),
        isPending: false,
        isScheduled: false,
        showPending: false,
        isSlow: false,
      };
      resolve(result);
      store.set(
        result.status === 'success'
          ? { ...next, status: 'success', data: result.data, error: undefined }
          : { ...next, status: 'error', error: result.error },
      );
    }

    const schedule = (ms: number, callback: () => void) => {
      flight.timers.push(
        setTimeout(() => {
          if (active === flight) callback();
        }, ms),
      );
    };
    let started = false;
    let scheduled: ReturnType<typeof setTimeout> | undefined;
    flight.start = () => {
      if (active !== flight || started) return;
      started = true;
      if (scheduled !== undefined) clearTimeout(scheduled);
      // Feedback and timeout clocks measure work, not time spent typing.
      if (delay > 0)
        schedule(delay, () =>
          store.set({ ...store.getSnapshot(), showPending: true }),
        );
      if (slow > 0)
        schedule(slow, () =>
          store.set({ ...store.getSnapshot(), isSlow: true }),
        );
      if (timeout !== undefined)
        schedule(timeout, () => {
          const error = new TimeoutError(timeout);
          settle({ status: 'error', error });
          flight.controller.abort(error);
        });
      if (debounce > 0)
        store.set({
          ...store.getSnapshot(),
          isScheduled: false,
          showPending: delay === 0,
          isSlow: slow === 0,
        });
      // A subscriber can synchronously cancel or supersede this operation.
      if (active !== flight) return;
      try {
        Promise.resolve(
          operation(input, { signal: flight.controller.signal, id: flight.id }),
        ).then(
          (data) => settle({ status: 'success', data }),
          (error: unknown) => settle({ status: 'error', error }),
        );
      } catch (error) {
        settle({ status: 'error', error });
      }
    };
    if (debounce > 0) {
      scheduled = setTimeout(flight.start, debounce);
      flight.timers.push(scheduled);
    }

    store.set({
      ...store.getSnapshot(),
      status: 'pending',
      input,
      error: undefined,
      isPending: true,
      isScheduled: debounce > 0,
      showPending: debounce === 0 && delay === 0,
      isSlow: debounce === 0 && slow === 0,
    });
    superseded?.controller.abort('superseded');
    if (debounce === 0) flight.start();
    return promise;
  }

  return {
    getSnapshot: store.getSnapshot,
    getInitialSnapshot: store.getInitialSnapshot,
    subscribe: store.subscribe,
    run,
    retry: () =>
      disposed
        ? Promise.resolve({ status: 'disposed' })
        : previous
          ? run(previous.input)
          : Promise.resolve({ status: 'idle' }),
    flush: () => active?.start(),
    cancel,
    reset() {
      if (disposed) return;
      const flight = detach('cancelled');
      previous = undefined;
      store.set(initial);
      flight?.controller.abort('cancelled');
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancel();
      store.clear();
    },
  };
}
