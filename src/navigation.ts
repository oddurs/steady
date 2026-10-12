import { createStore, type ReadableStore } from './store';
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
export interface NavigationSnapshot<T> extends TaskSnapshot<
  string,
  Destination<T>
> {
  /** The acknowledged destination; rolls back to current on failure or cancellation. */
  readonly selected: string;
  /** The destination whose content has actually committed. */
  readonly current: string;
}

export interface Navigation<T> extends ReadableStore<NavigationSnapshot<T>> {
  navigate: Task<string, Destination<T>>['run'];
  retry: Task<string, Destination<T>>['retry'];
  cancel(): void;
  reset(): void;
  dispose(): void;
}

/** For tabs, panels, or routers that can acknowledge completion with a promise. */
export function createNavigation<T>(
  load: Operation<string, T>,
  options: FeedbackOptions & { initial: Destination<T> },
): Navigation<T> {
  const task = createTask<string, Destination<T>>(
    async (destination, context) => ({
      destination,
      data: await load(destination, context),
    }),
    { ...options, initialData: options.initial, concurrency: 'latest' },
  );
  const derive = (): NavigationSnapshot<T> => {
    const snapshot = task.getSnapshot();
    const current = snapshot.data!.destination;
    return {
      ...snapshot,
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
    cancel: task.cancel,
    reset: task.reset,
    dispose() {
      task.dispose();
      unsubscribe();
      store.clear();
    },
  };
}
