import { createStore, type ReadableStore } from './store';
import {
  createTask,
  type FeedbackOptions,
  type Operation,
  type TaskResult,
} from './task';

export interface MutationSnapshot<I, T> {
  readonly status: 'idle' | 'pending' | 'success' | 'error';
  readonly input: I | undefined;
  /** Optimistic while pending, confirmed otherwise. */
  readonly data: T;
  readonly confirmed: T;
  readonly error: unknown;
  readonly isPending: boolean;
  readonly showPending: boolean;
  readonly isSlow: boolean;
}

export interface MutationOptions<I, T> extends Omit<
  FeedbackOptions,
  'timeoutMs'
> {
  initialData: T;
  /** Pure optimistic projection. Reapplied if confirmed data changes during a write. */
  optimistic?: (confirmed: T, input: I) => T;
}

export interface Mutation<I, T> extends ReadableStore<MutationSnapshot<I, T>> {
  run(input: I): Promise<TaskResult<T>>;
  /** Rebase on authoritative external data, including while a write is pending. */
  reconcile(data: T): void;
  /** Releases local resources; cannot undo a write already accepted by a server. */
  dispose(): void;
}

/** One write at a time. Explicit optimistic projection, automatic local rollback, no retries. */
export function createMutation<I, T>(
  write: Operation<I, T>,
  options: MutationOptions<I, T>,
): Mutation<I, T> {
  let confirmed = options.initialData;
  let projected = confirmed;
  let disposed = false;
  const task = createTask(write, {
    delayMs: options.delayMs ?? 150,
    slowMs: options.slowMs ?? 2500,
    concurrency: 'single',
  });
  const initial: MutationSnapshot<I, T> = {
    status: 'idle',
    input: undefined,
    data: confirmed,
    confirmed,
    error: undefined,
    isPending: false,
    showPending: false,
    isSlow: false,
  };
  const store = createStore(initial);
  let lastStatus = task.getSnapshot().status;
  const unsubscribe = task.subscribe(() => {
    const snapshot = task.getSnapshot();
    if (snapshot.status === 'success' && lastStatus !== 'success')
      confirmed = snapshot.data as T;
    lastStatus = snapshot.status;
    store.set({
      ...snapshot,
      confirmed,
      data: snapshot.isPending ? projected : confirmed,
    });
  });
  return {
    getSnapshot: store.getSnapshot,
    getInitialSnapshot: store.getInitialSnapshot,
    subscribe: store.subscribe,
    run(input) {
      if (disposed) return Promise.resolve({ status: 'disposed' });
      if (task.getSnapshot().isPending)
        return Promise.resolve({ status: 'busy' });
      try {
        projected = options.optimistic
          ? options.optimistic(confirmed, input)
          : confirmed;
      } catch (error) {
        store.set({
          ...store.getSnapshot(),
          status: 'error',
          input,
          error,
          data: confirmed,
        });
        return Promise.resolve({ status: 'error', error });
      }
      return task.run(input);
    },
    reconcile(data) {
      if (disposed) return;
      const snapshot = task.getSnapshot();
      // Calculate before assigning, so a throwing reducer leaves the store intact.
      const next =
        snapshot.isPending && options.optimistic
          ? options.optimistic(data, snapshot.input as I)
          : data;
      confirmed = data;
      projected = next;
      store.set({ ...store.getSnapshot(), confirmed, data: next });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      task.dispose();
      unsubscribe();
      store.clear();
    },
  };
}
