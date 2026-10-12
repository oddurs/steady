import { TimeoutError, type Operation, type TaskContext } from './task';

export interface PrefetchOptions {
  /** Lifetime after a speculative request succeeds. Default 10_000. */
  ttlMs?: number;
  /** Maximum retained entries, including in-flight requests. Default 8. */
  maxEntries?: number;
  /** Maximum simultaneous speculative requests. Excess requests are skipped, never queued. Default 2. */
  maxConcurrent?: number;
  /** Timeout for speculative work, removed if navigation claims it. Default 5_000. */
  timeoutMs?: number;
}

export type PrefetchResult<T> =
  | { status: 'success'; data: T }
  | { status: 'error'; error: unknown }
  | {
      status: 'skipped';
      reason: 'disabled' | 'capacity' | 'concurrency' | 'active';
    }
  | { status: 'cancelled' | 'disposed' };

/** Private consume-once cache. Foreground reads never populate it. */
export function createPrefetchCache<T>(
  load: Operation<string, T>,
  options: PrefetchOptions,
) {
  const ttl = options.ttlMs ?? 10_000;
  const maxEntries = options.maxEntries ?? 8;
  const maxConcurrent = options.maxConcurrent ?? 2;
  const timeout = options.timeoutMs ?? 5_000;
  for (const [name, value] of [
    ['ttlMs', ttl],
    ['timeoutMs', timeout],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || value > 2_147_483_647)
      throw new RangeError(
        `prefetch.${name} must be a finite, non-negative timer duration.`,
      );
  }
  for (const [name, value] of [
    ['maxEntries', maxEntries],
    ['maxConcurrent', maxConcurrent],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 1)
      throw new RangeError(`prefetch.${name} must be a positive safe integer.`);
  }

  type Entry = {
    controller: AbortController;
    result: Promise<PrefetchResult<T>>;
    finish(result: PrefetchResult<T>): void;
    settled: boolean;
    expiresAt: number;
    timer: ReturnType<typeof setTimeout> | undefined;
  };
  const entries = new Map<string, Entry>();
  let disposed = false;
  let sequence = 0;

  function prune() {
    const now = Date.now();
    for (const [key, entry] of entries)
      if (entry.settled && entry.expiresAt <= now) entries.delete(key);
  }

  function cancel(entry: Entry) {
    if (entry.settled) return;
    entry.finish({ status: 'cancelled' });
    entry.controller.abort('cancelled');
  }

  function invalidate(destination?: string) {
    if (destination !== undefined) {
      const entry = entries.get(destination);
      entries.delete(destination);
      if (entry) cancel(entry);
    } else {
      const obsolete = [...entries.values()];
      entries.clear();
      obsolete.forEach(cancel);
    }
  }

  function prefetch(destination: string): Promise<PrefetchResult<T>> {
    if (disposed) return Promise.resolve({ status: 'disposed' });
    prune();
    const existing = entries.get(destination);
    if (existing) {
      entries.delete(destination);
      entries.set(destination, existing);
      return existing.result;
    }
    const pending = [...entries.values()].filter(
      (entry) => !entry.settled,
    ).length;
    if (pending >= maxConcurrent)
      return Promise.resolve({ status: 'skipped', reason: 'concurrency' });
    if (entries.size >= maxEntries) {
      const oldest = [...entries].find(([, entry]) => entry.settled);
      if (!oldest)
        return Promise.resolve({ status: 'skipped', reason: 'capacity' });
      entries.delete(oldest[0]);
    }

    let resolve!: (result: PrefetchResult<T>) => void;
    const result = new Promise<PrefetchResult<T>>((done) => {
      resolve = done;
    });
    const entry: Entry = {
      controller: new AbortController(),
      result,
      settled: false,
      expiresAt: Infinity,
      timer: undefined,
      finish(outcome) {
        if (entry.settled) return;
        entry.settled = true;
        clearTimeout(entry.timer);
        if (outcome.status === 'success') entry.expiresAt = Date.now() + ttl;
        else if (entries.get(destination) === entry)
          entries.delete(destination);
        resolve(outcome);
      },
    };
    entries.set(destination, entry);
    entry.timer = setTimeout(() => {
      const error = new TimeoutError(timeout);
      entry.finish({ status: 'error', error });
      entry.controller.abort(error);
    }, timeout);
    try {
      // Negative ids distinguish speculative requests from foreground task ids.
      Promise.resolve(
        load(destination, { signal: entry.controller.signal, id: --sequence }),
      ).then(
        (data) => entry.finish({ status: 'success', data }),
        (error: unknown) => entry.finish({ status: 'error', error }),
      );
    } catch (error) {
      entry.finish({ status: 'error', error });
    }
    return result;
  }

  function consume(
    destination: string,
    context: TaskContext,
  ): T | PromiseLike<T> {
    if (context.signal.aborted) throw context.signal.reason;
    if (disposed) throw new Error('The prefetch cache has been disposed.');
    prune();
    const entry = entries.get(destination);
    if (!entry) return load(destination, context);
    // Ownership transfers to navigation. Invalidation and speculative timeouts
    // must no longer abort a request the user is actively waiting for.
    entries.delete(destination);
    clearTimeout(entry.timer);
    const abort = () => cancel(entry);
    context.signal.addEventListener('abort', abort, { once: true });
    return entry.result.then((result) => {
      context.signal.removeEventListener('abort', abort);
      if (context.signal.aborted) throw context.signal.reason;
      if (result.status === 'success') return result.data;
      if (result.status === 'error') throw result.error;
      throw new Error('The prefetched request was cancelled.');
    });
  }

  return {
    prefetch,
    consume,
    invalidate,
    dispose() {
      if (disposed) return;
      disposed = true;
      invalidate();
    },
  };
}
