'use client';

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import {
  createTask,
  createNavigation,
  createMutation,
  type ReadableStore,
  type Operation,
  type TaskOptions,
  type FeedbackOptions,
  type Destination,
  type MutationOptions,
} from '@oddurs/steady';

const FeedbackContext = createContext<FeedbackOptions>({});
const useCommitEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Defaults are captured when a hook mounts. Override them per interaction. */
export function SteadyProvider({
  children,
  ...options
}: FeedbackOptions & { children: ReactNode }) {
  const parent = useContext(FeedbackContext);
  const value = useMemo(
    () => ({ ...parent, ...options }),
    [parent, options.delayMs, options.slowMs, options.timeoutMs],
  );
  return (
    <FeedbackContext.Provider value={value}>
      {children}
    </FeedbackContext.Provider>
  );
}

/** Subscribe to any Steady store, including stores owned outside React. */
export function useStore<T>(store: ReadableStore<T>): T {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getInitialSnapshot,
  );
}

function useLatest<T>(value: T) {
  const ref = useRef(value);
  // Only committed renders can change the callback used by an active controller.
  useCommitEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

function useDisposal(controller: { dispose(): void }) {
  const lifecycle = useRef(0);
  useEffect(() => {
    const generation = ++lifecycle.current;
    return () => {
      // StrictMode replays effects. Defer disposal one microtask to allow reattachment.
      queueMicrotask(() => {
        if (lifecycle.current === generation) controller.dispose();
      });
    };
  }, [controller]);
}

export function useTask<I, T>(
  operation: Operation<I, T>,
  options: TaskOptions<T> = {},
) {
  const defaults = useContext(FeedbackContext);
  const callback = useLatest(operation);
  const [task] = useState(() =>
    createTask<I, T>((input, context) => callback.current(input, context), {
      ...defaults,
      ...options,
    }),
  );
  useDisposal(task);
  const snapshot = useStore(task);
  return {
    ...snapshot,
    run: task.run,
    retry: task.retry,
    cancel: task.cancel,
    reset: task.reset,
  };
}

export function useNavigation<T>(
  load: Operation<string, T>,
  options: FeedbackOptions & { initial: Destination<T> },
) {
  const defaults = useContext(FeedbackContext);
  const callback = useLatest(load);
  const [navigation] = useState(() =>
    createNavigation<T>((input, context) => callback.current(input, context), {
      ...defaults,
      ...options,
    }),
  );
  useDisposal(navigation);
  const snapshot = useStore(navigation);
  return {
    ...snapshot,
    navigate: navigation.navigate,
    retry: navigation.retry,
    cancel: navigation.cancel,
    reset: navigation.reset,
  };
}

export function useMutation<I, T>(
  operation: Operation<I, T>,
  options: MutationOptions<I, T>,
) {
  const defaults = useContext(FeedbackContext);
  const callback = useLatest(operation);
  const optimistic = useLatest(options.optimistic);
  const [mutation] = useState(() =>
    createMutation<I, T>((input, context) => callback.current(input, context), {
      ...options,
      delayMs: options.delayMs ?? defaults.delayMs ?? 150,
      slowMs: options.slowMs ?? defaults.slowMs ?? 2500,
      optimistic: (confirmed, input) =>
        optimistic.current ? optimistic.current(confirmed, input) : confirmed,
    }),
  );
  useDisposal(mutation);
  const snapshot = useStore(mutation);
  return { ...snapshot, run: mutation.run, reconcile: mutation.reconcile };
}

export interface PendingProps extends HTMLAttributes<HTMLSpanElement> {
  state: { showPending: boolean; isSlow: boolean };
  slow?: ReactNode;
}

/** A persistent live region. Style its dimensions to reserve room for feedback. */
export function Pending({
  state,
  slow,
  children = 'Working…',
  ...props
}: PendingProps) {
  return (
    <span role="status" aria-live="polite" aria-atomic="true" {...props}>
      {state.showPending
        ? state.isSlow
          ? (slow ?? children)
          : children
        : null}
    </span>
  );
}
