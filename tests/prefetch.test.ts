import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNavigation, TimeoutError } from '../src';
import { deferred } from './helpers';

const initial = { destination: '/', data: 'Home' };

describe('navigation prefetch', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('is opt-in and never starts requests implicitly', async () => {
    const load = vi.fn((path: string) => path);
    const nav = createNavigation(load, { initial });
    expect(await nav.prefetch('/next')).toEqual({
      status: 'skipped',
      reason: 'disabled',
    });
    expect(load).not.toHaveBeenCalled();
    expect(nav.getSnapshot().current).toBe('/');
  });

  it('warms silently, consumes once, and then fetches fresh data', async () => {
    const load = vi.fn((path: string) => `${path}:${load.mock.calls.length}`);
    const nav = createNavigation(load, { initial, prefetch: {} });
    const snapshot = nav.getSnapshot();
    expect(await nav.prefetch('/next')).toEqual({
      status: 'success',
      data: '/next:1',
    });
    expect(nav.getSnapshot()).toBe(snapshot);
    await nav.navigate('/next');
    expect(nav.getSnapshot().data.data).toBe('/next:1');
    expect(load).toHaveBeenCalledTimes(1);
    await nav.navigate('/next');
    expect(nav.getSnapshot().data.data).toBe('/next:2');
  });

  it('deduplicates intent signals and promotes an in-flight prefetch', async () => {
    const request = deferred<string>();
    const load = vi.fn(() => request.promise);
    const nav = createNavigation(load, { initial, prefetch: {} });
    const hover = nav.prefetch('/next');
    expect(nav.prefetch('/next')).toBe(hover);
    const clicked = nav.navigate('/next');
    expect(nav.getSnapshot()).toMatchObject({
      selected: '/next',
      current: '/',
      isPending: true,
    });
    expect(await nav.prefetch('/next')).toEqual({
      status: 'skipped',
      reason: 'active',
    });
    request.resolve('Next');
    expect(await hover).toEqual({ status: 'success', data: 'Next' });
    expect((await clicked).status).toBe('success');
    expect(load).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds speculative concurrency without queueing or blocking navigation', async () => {
    const request = deferred<string>();
    const load = vi.fn((path: string) =>
      path === '/warm' ? request.promise : 'Clicked',
    );
    const nav = createNavigation(load, {
      initial,
      prefetch: { maxConcurrent: 1 },
    });
    const warm = nav.prefetch('/warm');
    expect(await nav.prefetch('/skipped')).toEqual({
      status: 'skipped',
      reason: 'concurrency',
    });
    await nav.navigate('/clicked');
    expect(nav.getSnapshot().current).toBe('/clicked');
    request.resolve('Warm');
    await warm;
    expect(load.mock.calls.map(([path]) => path)).toEqual([
      '/warm',
      '/clicked',
    ]);
  });

  it('does not evict active requests to make room', async () => {
    const nav = createNavigation(() => new Promise<string>(() => {}), {
      initial,
      prefetch: { maxEntries: 1, maxConcurrent: 2 },
    });
    const warm = nav.prefetch('/first');
    expect(await nav.prefetch('/second')).toEqual({
      status: 'skipped',
      reason: 'capacity',
    });
    nav.dispose();
    expect(await warm).toEqual({ status: 'cancelled' });
  });

  it('evicts the least recently used completed entry', async () => {
    const load = vi.fn((path: string) => path);
    const nav = createNavigation(load, {
      initial,
      prefetch: { maxEntries: 2 },
    });
    await nav.prefetch('/a');
    await nav.prefetch('/b');
    await nav.prefetch('/a');
    await nav.prefetch('/c');
    await nav.navigate('/b');
    await nav.navigate('/a');
    expect(load.mock.calls.map(([path]) => path)).toEqual([
      '/a',
      '/b',
      '/c',
      '/b',
    ]);
  });

  it('expires completed data without extending its lifetime on access', async () => {
    const load = vi.fn((path: string) => path);
    const nav = createNavigation(load, { initial, prefetch: { ttlMs: 100 } });
    await nav.prefetch('/next');
    vi.advanceTimersByTime(90);
    await nav.prefetch('/next');
    vi.advanceTimersByTime(10);
    await nav.navigate('/next');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('starts expiry when data arrives, not when the request started', async () => {
    const request = deferred<string>();
    const load = vi.fn(() => request.promise);
    const nav = createNavigation(load, { initial, prefetch: { ttlMs: 100 } });
    const warm = nav.prefetch('/next');
    vi.advanceTimersByTime(1000);
    request.resolve('Next');
    await warm;
    vi.advanceTimersByTime(99);
    await nav.navigate('/next');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('removes speculative failures so an actual navigation can retry', async () => {
    const load = vi
      .fn<(path: string) => Promise<string>>()
      .mockRejectedValueOnce(Error('offline'))
      .mockResolvedValueOnce('Next');
    const nav = createNavigation(load, { initial, prefetch: {} });
    expect((await nav.prefetch('/next')).status).toBe('error');
    expect(nav.getSnapshot().status).toBe('idle');
    await nav.navigate('/next');
    expect(nav.getSnapshot().data.data).toBe('Next');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('handles synchronous speculative loader errors without throwing', async () => {
    const nav = createNavigation(
      () => {
        throw Error('sync');
      },
      { initial, prefetch: {} },
    );
    expect((await nav.prefetch('/next')).status).toBe('error');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('times out hung speculation and ignores late completion', async () => {
    const request = deferred<string>();
    const load = vi.fn(() => request.promise);
    const nav = createNavigation(load, {
      initial,
      prefetch: { timeoutMs: 100 },
    });
    const warm = nav.prefetch('/next');
    vi.advanceTimersByTime(100);
    expect(await warm).toMatchObject({
      status: 'error',
      error: expect.any(TimeoutError),
    });
    request.resolve('Late');
    await Promise.resolve();
    await nav.navigate('/next');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('transfers timeout ownership to navigation when a prefetch is claimed', async () => {
    const request = deferred<string>();
    const nav = createNavigation(() => request.promise, {
      initial,
      timeoutMs: 500,
      prefetch: { timeoutMs: 100 },
    });
    const warm = nav.prefetch('/next');
    vi.advanceTimersByTime(90);
    const clicked = nav.navigate('/next');
    vi.advanceTimersByTime(410);
    expect(nav.getSnapshot().isPending).toBe(true);
    request.resolve('Next');
    await clicked;
    expect((await warm).status).toBe('success');
    expect(nav.getSnapshot().current).toBe('/next');
  });

  it('aborts a promoted request when its navigation is superseded', async () => {
    const request = deferred<string>();
    let signal!: AbortSignal;
    const nav = createNavigation(
      (path, context) => {
        if (path === '/first') {
          signal = context.signal;
          return request.promise;
        }
        return 'Latest';
      },
      { initial, prefetch: {} },
    );
    const warm = nav.prefetch('/first');
    const first = nav.navigate('/first');
    await nav.navigate('/latest');
    expect(signal.aborted).toBe(true);
    expect(await first).toEqual({ status: 'superseded' });
    expect(await warm).toEqual({ status: 'cancelled' });
    request.resolve('Stale');
    await Promise.resolve();
    expect(nav.getSnapshot().current).toBe('/latest');
  });

  it('invalidates by exact key and does not revive aborted entries', async () => {
    const request = deferred<string>();
    const load = vi.fn((path: string) =>
      path === '/a' ? request.promise : path,
    );
    const nav = createNavigation(load, { initial, prefetch: {} });
    const warm = nav.prefetch('/a');
    await nav.prefetch('/b');
    nav.invalidatePrefetch('/a');
    expect(await warm).toEqual({ status: 'cancelled' });
    request.resolve('Late');
    await Promise.resolve();
    await nav.navigate('/b');
    await nav.navigate('/a');
    expect(load.mock.calls.map(([path]) => path)).toEqual(['/a', '/b', '/a']);
  });

  it('invalidation does not abort a request already claimed by navigation', async () => {
    const request = deferred<string>();
    const nav = createNavigation(() => request.promise, {
      initial,
      prefetch: {},
    });
    void nav.prefetch('/next');
    const clicked = nav.navigate('/next');
    nav.invalidatePrefetch();
    request.resolve('Next');
    expect((await clicked).status).toBe('success');
  });

  it('reset clears speculative entries and disposal stops all owned work', async () => {
    const load = vi.fn((path: string) => path);
    const nav = createNavigation(load, { initial, prefetch: {} });
    await nav.prefetch('/a');
    await nav.prefetch('/b');
    nav.reset();
    await nav.navigate('/a');
    expect(load).toHaveBeenCalledTimes(3);
    nav.dispose();
    expect(await nav.prefetch('/new')).toEqual({ status: 'disposed' });
    expect(await nav.navigate('/new')).toEqual({ status: 'disposed' });
  });

  it('settles both promises and clears all timers when disposed during promotion', async () => {
    const nav = createNavigation(() => new Promise<string>(() => {}), {
      initial,
      prefetch: {},
    });
    const warm = nav.prefetch('/next');
    const clicked = nav.navigate('/next');
    nav.dispose();
    expect(await warm).toEqual({ status: 'cancelled' });
    expect(await clicked).toEqual({ status: 'cancelled' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    { ttlMs: -1 },
    { ttlMs: Infinity },
    { timeoutMs: NaN },
    { maxEntries: 0 },
    { maxEntries: 1.5 },
    { maxConcurrent: 0 },
    { maxConcurrent: Infinity },
  ])('validates budgets %j', (prefetch) => {
    expect(() =>
      createNavigation((path) => path, { initial, prefetch }),
    ).toThrow(RangeError);
  });
});
