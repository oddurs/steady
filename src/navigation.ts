import { createStore, type ReadableStore } from './store';
import {
  createPrefetchCache,
  type PrefetchOptions,
  type PrefetchResult,
} from './prefetch';
import {
  createTask,
  type FeedbackOptions,
  type Operation,
  type Task,
  type TaskSnapshot,
} from './task';

export interface Destination<T> {
  destination: string;
  data: T;
}
export interface NavigationOptions<T> extends FeedbackOptions {
  initial: Destination<T>;
  /** Opt in to bounded, consume-once speculative reads. No requests start automatically. */
  prefetch?: PrefetchOptions | false;
}
export interface NavigationSnapshot<T> extends TaskSnapshot<
  string,
  Destination<T>
> {
  readonly data: Destination<T>;
  /** The acknowledged destination; rolls back to current on failure or cancellation. */
  readonly selected: string;
  /** The destination whose content has actually committed. */
  readonly current: string;
}

export interface Navigation<T> extends ReadableStore<NavigationSnapshot<T>> {
  navigate: Task<string, Destination<T>>['run'];
  retry: Task<string, Destination<T>>['retry'];
  /** Warm this exact destination without changing selection or visible errors. */
  prefetch(destination: string): Promise<PrefetchResult<T>>;
  /** Drop speculative entries. Omit destination to clear all of them. */
  invalidatePrefetch(destination?: string): void;
  cancel(): void;
  reset(): void;
  dispose(): void;
}

/** For tabs, panels, or routers that can acknowledge completion with a promise. */
export function createNavigation<T>(
  load: Operation<string, T>,
  options: NavigationOptions<T>,
): Navigation<T> {
  const cache = options.prefetch
    ? createPrefetchCache(load, options.prefetch)
    : undefined;
  let disposed = false;
  const task = createTask<string, Destination<T>>(
    async (destination, context) => ({
      destination,
      data: await (cache
        ? cache.consume(destination, context)
        : load(destination, context)),
    }),
    { ...options, initialData: options.initial, concurrency: 'latest' },
  );
  const derive = (): NavigationSnapshot<T> => {
    const snapshot = task.getSnapshot();
    const current = snapshot.data!.destination;
    return {
      ...snapshot,
      data: snapshot.data!,
      current,
      selected: snapshot.isPending ? snapshot.input! : current,
    };
  };
  const store = createStore(derive());
  const unsubscribe = task.subscribe(() => store.set(derive()));
  return {
    getSnapshot: store.getSnapshot,
    getInitialSnapshot: store.getInitialSnapshot,
    subscribe: store.subscribe,
    navigate: task.run,
    retry: task.retry,
    prefetch(destination) {
      if (disposed) return Promise.resolve({ status: 'disposed' });
      if (!cache)
        return Promise.resolve({ status: 'skipped', reason: 'disabled' });
      const snapshot = task.getSnapshot();
      if (snapshot.isPending && snapshot.input === destination)
        return Promise.resolve({ status: 'skipped', reason: 'active' });
      return cache.prefetch(destination);
    },
    invalidatePrefetch: (destination) => cache?.invalidate(destination),
    cancel: task.cancel,
    reset() {
      cache?.invalidate();
      task.reset();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      task.dispose();
      cache?.dispose();
      unsubscribe();
      store.clear();
    },
  };
}
