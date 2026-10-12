import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTask, TimeoutError } from '../src';
import { deferred } from './helpers';

describe('tasks', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('acknowledges intent synchronously and preserves useful data', async () => {
    const request = deferred<string>();
    const task = createTask((_: string) => request.promise, {
      initialData: 'old',
    });
    const result = task.run('new');
    expect(task.getSnapshot()).toMatchObject({
      input: 'new',
      isPending: true,
      showPending: false,
      data: 'old',
    });
    request.resolve('new data');
    expect(await result).toEqual({ status: 'success', data: 'new data' });
    expect(task.getSnapshot()).toMatchObject({
      status: 'success',
      data: 'new data',
      isPending: false,
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('delays visual loading, marks slow work, and never delays successful data', async () => {
    const request = deferred<string>();
    const task = createTask(() => request.promise, {
      delayMs: 150,
      slowMs: 1000,
    });
    const result = task.run(undefined);
    vi.advanceTimersByTime(149);
    expect(task.getSnapshot().showPending).toBe(false);
    vi.advanceTimersByTime(1);
    expect(task.getSnapshot().showPending).toBe(true);
    vi.advanceTimersByTime(850);
    expect(task.getSnapshot().isSlow).toBe(true);
    request.resolve('done');
    await result;
    expect(task.getSnapshot()).toMatchObject({
      showPending: false,
      isSlow: false,
      data: 'done',
    });
  });

  it('never flashes loading for fast operations', async () => {
    const task = createTask(async () => 42);
    const states: boolean[] = [];
    task.subscribe(() => states.push(task.getSnapshot().showPending));
    await task.run(undefined);
    vi.advanceTimersByTime(5000);
    expect(states).toEqual([false, false]);
  });

  it('settles superseded calls immediately, even if a transport ignores abort', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const signals: AbortSignal[] = [];
    const task = createTask((input: number, { signal }) => {
      signals.push(signal);
      return input === 1 ? first.promise : second.promise;
    });
    const a = task.run(1);
    const b = task.run(2);
    expect(await a).toEqual({ status: 'superseded' });
    expect(signals[0]!.aborted).toBe(true);
    second.resolve('second');
    await b;
    first.resolve('stale first');
    await Promise.resolve();
    expect(task.getSnapshot().data).toBe('second');
  });

  it('ignores stale failures without unhandled rejections', async () => {
    const first = deferred<string>();
    const task = createTask((n: number) =>
      n === 1 ? first.promise : Promise.resolve('new'),
    );
    void task.run(1);
    await task.run(2);
    first.reject(new Error('old failure'));
    await Promise.resolve();
    expect(task.getSnapshot()).toMatchObject({
      status: 'success',
      data: 'new',
      error: undefined,
    });
  });

  it('keeps data after failure and retries only when asked', async () => {
    const operation = vi
      .fn<(input: string) => Promise<string>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce('recovered');
    const task = createTask(operation, { initialData: 'useful' });
    expect(await task.retry()).toEqual({ status: 'idle' });
    expect((await task.run('query')).status).toBe('error');
    expect(task.getSnapshot()).toMatchObject({
      status: 'error',
      data: 'useful',
    });
    expect(operation).toHaveBeenCalledTimes(1);
    await task.retry();
    expect(operation.mock.calls.map(([input]) => input)).toEqual([
      'query',
      'query',
    ]);
    expect(task.getSnapshot().data).toBe('recovered');
  });

  it('turns synchronous throws into explicit errors', async () => {
    const error = new Error('sync');
    const task = createTask(() => {
      throw error;
    });
    expect(await task.run(undefined)).toEqual({ status: 'error', error });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('blocks concurrent calls in single mode without sharing unrelated results', async () => {
    const request = deferred<string>();
    const operation = vi.fn(() => request.promise);
    const task = createTask(operation, { concurrency: 'single' });
    const first = task.run(undefined);
    expect(await task.run(undefined)).toEqual({ status: 'busy' });
    expect(operation).toHaveBeenCalledTimes(1);
    request.resolve('saved');
    await first;
  });

  it('cancels hung operations immediately and can be reused', async () => {
    const task = createTask((n: number) =>
      n === 1 ? new Promise<number>(() => {}) : n,
    );
    const pending = task.run(1);
    task.cancel();
    expect(await pending).toEqual({ status: 'cancelled' });
    expect(task.getSnapshot().isPending).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(await task.run(2)).toEqual({ status: 'success', data: 2 });
  });

  it('times out locally without accepting a late transport result', async () => {
    const request = deferred<string>();
    let signal!: AbortSignal;
    const task = createTask(
      (_, context) => {
        signal = context.signal;
        return request.promise;
      },
      { timeoutMs: 1000 },
    );
    const result = task.run(undefined);
    vi.advanceTimersByTime(1000);
    expect(await result).toMatchObject({
      status: 'error',
      error: expect.any(TimeoutError),
    });
    expect(signal.aborted).toBe(true);
    request.resolve('late');
    await Promise.resolve();
    expect(task.getSnapshot().status).toBe('error');
  });

  it('resets initial data and retry input', async () => {
    const task = createTask((n: number) => n, { initialData: 1 });
    await task.run(2);
    task.reset();
    expect(task.getSnapshot()).toEqual(task.getInitialSnapshot());
    expect(await task.retry()).toEqual({ status: 'idle' });
  });

  it('disposes timers, subscribers, and pending promises', async () => {
    const task = createTask(() => new Promise(() => {}));
    const result = task.run(undefined);
    task.dispose();
    expect(await result).toEqual({ status: 'cancelled' });
    expect(await task.run(undefined)).toEqual({ status: 'disposed' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('supports cancellation by a synchronous subscriber', async () => {
    const operation = vi.fn(() => 1);
    const task = createTask(operation);
    task.subscribe(() => {
      if (task.getSnapshot().isPending) task.cancel();
    });
    expect(await task.run(undefined)).toEqual({ status: 'cancelled' });
    expect(operation).not.toHaveBeenCalled();
  });

  it('preserves newer work started synchronously by an abort listener', async () => {
    const request = deferred<string>();
    const task = createTask((input: string, { signal }) => {
      if (input === 'first') {
        signal.addEventListener('abort', () => {
          void task.run('newest');
        });
        return new Promise<string>(() => {});
      }
      return request.promise;
    });
    const first = task.run('first');
    const second = task.run('second');
    expect(await first).toEqual({ status: 'superseded' });
    expect(await second).toEqual({ status: 'superseded' });
    expect(task.getSnapshot()).toMatchObject({
      input: 'newest',
      isPending: true,
    });
    request.resolve('newest data');
    await Promise.resolve();
    expect(task.getSnapshot().data).toBe('newest data');
  });

  it('does not clear pending feedback for work started by a cancellation listener', async () => {
    const task = createTask((input: string, { signal }) => {
      if (input === 'first')
        signal.addEventListener('abort', () => {
          void task.run('new');
        });
      return new Promise<string>(() => {});
    });
    void task.run('first');
    task.cancel();
    expect(task.getSnapshot()).toMatchObject({ input: 'new', isPending: true });
    task.dispose();
  });

  it('returns stable, shallowly immutable snapshots and supports unsubscribe', async () => {
    const task = createTask(() => 1);
    expect(task.getSnapshot()).toBe(task.getSnapshot());
    expect(Object.isFrozen(task.getSnapshot())).toBe(true);
    const listener = vi.fn();
    const unsubscribe = task.subscribe(listener);
    unsubscribe();
    await task.run(undefined);
    expect(listener).not.toHaveBeenCalled();
    expect(task.getInitialSnapshot().status).toBe('idle');
  });

  it.each([-1, Infinity, NaN, 2 ** 32])(
    'rejects invalid timer duration %s',
    (delayMs) => {
      expect(() => createTask(() => 1, { delayMs })).toThrow(RangeError);
    },
  );
});
