import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTask, TimeoutError } from '../src';
import { deferred } from './helpers';

describe('debounced tasks', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('acknowledges every input immediately but executes only the latest', async () => {
    const operation = vi.fn((query: string) => query.toUpperCase());
    const task = createTask(operation, { debounceMs: 250, initialData: 'old' });
    const first = task.run('de');
    expect(task.getSnapshot()).toMatchObject({
      input: 'de',
      isPending: true,
      isScheduled: true,
      data: 'old',
    });
    vi.advanceTimersByTime(200);
    const latest = task.run('design');
    expect(await first).toEqual({ status: 'superseded' });
    vi.advanceTimersByTime(249);
    expect(operation).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(await latest).toEqual({ status: 'success', data: 'DESIGN' });
    expect(operation).toHaveBeenCalledTimes(1);
    expect(task.getSnapshot().isScheduled).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts feedback and timeout clocks when the operation actually starts', async () => {
    const task = createTask(() => new Promise<string>(() => {}), {
      debounceMs: 1000,
      delayMs: 150,
      slowMs: 300,
      timeoutMs: 500,
    });
    const result = task.run(undefined);
    vi.advanceTimersByTime(999);
    expect(task.getSnapshot()).toMatchObject({
      isScheduled: true,
      showPending: false,
      isSlow: false,
    });
    vi.advanceTimersByTime(150);
    expect(task.getSnapshot()).toMatchObject({
      isScheduled: false,
      showPending: false,
    });
    vi.advanceTimersByTime(1);
    expect(task.getSnapshot().showPending).toBe(true);
    vi.advanceTimersByTime(150);
    expect(task.getSnapshot().isSlow).toBe(true);
    vi.advanceTimersByTime(200);
    expect(await result).toMatchObject({
      status: 'error',
      error: expect.any(TimeoutError),
    });
  });

  it('flushes the same pending promise exactly once', async () => {
    const request = deferred<string>();
    const operation = vi.fn(() => request.promise);
    const task = createTask(operation, { debounceMs: 500 });
    const result = task.run(undefined);
    task.flush();
    task.flush();
    vi.advanceTimersByTime(500);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(task.getSnapshot().isScheduled).toBe(false);
    request.resolve('done');
    expect(await result).toEqual({ status: 'success', data: 'done' });
  });

  it.each(['cancel', 'reset', 'dispose'] as const)(
    '%s prevents scheduled work from starting',
    async (method) => {
      const operation = vi.fn(() => 'done');
      const task = createTask(operation, { debounceMs: 250 });
      const result = task.run(undefined);
      task[method]();
      task.flush();
      vi.runAllTimers();
      expect(await result).toEqual({ status: 'cancelled' });
      expect(operation).not.toHaveBeenCalled();
      expect(task.getSnapshot().isScheduled).toBe(false);
    },
  );

  it('supersedes active transport before waiting for new input', async () => {
    const request = deferred<string>();
    let signal!: AbortSignal;
    const task = createTask(
      (_: string, context) => {
        signal = context.signal;
        return request.promise;
      },
      { debounceMs: 100 },
    );
    const first = task.run('first');
    task.flush();
    const latest = task.run('latest');
    expect(signal.aborted).toBe(true);
    expect(await first).toEqual({ status: 'superseded' });
    request.resolve('old');
    await Promise.resolve();
    expect(task.getSnapshot()).toMatchObject({
      input: 'latest',
      data: undefined,
      isScheduled: true,
    });
    task.cancel();
    await latest;
  });

  it('respects single concurrency while a request is scheduled', async () => {
    const task = createTask((n: number) => n, {
      debounceMs: 100,
      concurrency: 'single',
    });
    const result = task.run(1);
    expect(await task.run(2)).toEqual({ status: 'busy' });
    task.flush();
    expect(await result).toEqual({ status: 'success', data: 1 });
  });

  it('can be cancelled by a subscriber at the moment scheduled work starts', async () => {
    const operation = vi.fn(() => 1);
    const task = createTask(operation, { debounceMs: 100 });
    task.subscribe(() => {
      const state = task.getSnapshot();
      if (state.isPending && !state.isScheduled) task.cancel();
    });
    const result = task.run(undefined);
    task.flush();
    expect(await result).toEqual({ status: 'cancelled' });
    expect(operation).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports disposed from retry even when it has never run', async () => {
    const task = createTask(() => 1);
    task.dispose();
    expect(await task.retry()).toEqual({ status: 'disposed' });
  });

  it.each([-1, Infinity, NaN])(
    'rejects invalid debounce duration %s',
    (debounceMs) => {
      expect(() => createTask(() => 1, { debounceMs })).toThrow(RangeError);
    },
  );
});
