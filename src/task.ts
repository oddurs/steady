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
      ['delayMs', 'slowMs', 'timeoutMs'].includes(name) &&
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
  const initial: TaskSnapshot<I, T> = {
    status: 'idle',
    input: undefined,
    data: options.initialData,
    error: undefined,
    isPending: false,
    showPending: false,
    isSlow: false,
  };
  const store = createStore(initial);
  type Flight = {
    id: number;
    controller: AbortController;
    timers: ReturnType<typeof setTimeout>[];
    resolve: (result: TaskResult<T>) => void;
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
      showPending: false,
      isSlow: false,
    });
    // Abort listeners may synchronously start new work. Publish first so that
    // their newer intent cannot be overwritten by this cancellation.
    flight?.controller.abort('cancelled');
  }

  function run(input: I): Promise<TaskResult<T>> {
    if (disposed) return Promise.resolve({ status: 'disposed' });
    if (active && options.concurrency === 'single')
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
    if (delay > 0)
      schedule(delay, () =>
        store.set({ ...store.getSnapshot(), showPending: true }),
      );
    if (slow > 0)
      schedule(slow, () => store.set({ ...store.getSnapshot(), isSlow: true }));
    if (options.timeoutMs !== undefined)
      schedule(options.timeoutMs, () => {
        const error = new TimeoutError(options.timeoutMs!);
        settle({ status: 'error', error });
        flight.controller.abort(error);
      });

    store.set({
      ...store.getSnapshot(),
      status: 'pending',
      input,
      error: undefined,
      isPending: true,
      showPending: delay === 0,
      isSlow: slow === 0,
    });
    superseded?.controller.abort('superseded');
    // A subscriber can synchronously cancel or supersede this operation.
    if (active !== flight) return promise;
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
    return promise;
  }

  return {
    getSnapshot: store.getSnapshot,
    getInitialSnapshot: store.getInitialSnapshot,
    subscribe: store.subscribe,
    run,
    retry: () =>
      previous ? run(previous.input) : Promise.resolve({ status: 'idle' }),
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
