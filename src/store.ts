/** A minimal external store, compatible with React, Vue, Svelte, and vanilla JS. */
export interface ReadableStore<T> {
  getSnapshot(): T;
  /** The immutable initial snapshot. Supply identical initial data during hydration. */
  getInitialSnapshot(): T;
  subscribe(listener: () => void): () => void;
}

export function createStore<T extends object>(initial: T) {
  const first = Object.freeze(initial);
  let snapshot: T = first;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    getInitialSnapshot: () => first,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set(next: T) {
      snapshot = Object.freeze(next);
      for (const listener of [...listeners]) listener();
    },
    clear() {
      listeners.clear();
    },
  };
}
