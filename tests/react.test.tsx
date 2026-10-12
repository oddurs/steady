// @vitest-environment jsdom
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Pending,
  SteadyProvider,
  useMutation,
  useNavigation,
  useTask,
} from '../src/react';
import { deferred } from './helpers';

afterEach(cleanup);

describe('React integration', () => {
  it('survives StrictMode effect replay and aborts on unmount', async () => {
    let signal!: AbortSignal;
    const { result, unmount } = renderHook(
      () =>
        useTask((_: string, context) => {
          signal = context.signal;
          return new Promise<string>(() => {});
        }),
      { wrapper: StrictMode },
    );
    await act(async () => {});
    let pending!: ReturnType<typeof result.current.run>;
    act(() => {
      pending = result.current.run('hello');
    });
    expect(result.current.isPending).toBe(true);
    unmount();
    await act(async () => {});
    expect(signal.aborted).toBe(true);
    expect(await pending).toEqual({ status: 'cancelled' });
  });

  it('uses the latest committed operation without recreating the controller', async () => {
    const { result, rerender } = renderHook(
      ({ multiplier }) => useTask((n: number) => n * multiplier),
      { initialProps: { multiplier: 2 } },
    );
    const run = result.current.run;
    await act(async () => {
      await result.current.run(3);
    });
    expect(result.current.data).toBe(6);
    rerender({ multiplier: 4 });
    expect(result.current.run).toBe(run);
    await act(async () => {
      await result.current.run(3);
    });
    expect(result.current.data).toBe(12);
  });

  it('inherits feedback defaults and allows local overrides', async () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(
      () => useTask(() => new Promise(() => {}), { slowMs: 50 }),
      {
        wrapper: ({ children }) => (
          <SteadyProvider delayMs={0} slowMs={1000}>
            {children}
          </SteadyProvider>
        ),
      },
    );
    act(() => {
      void result.current.run(undefined);
    });
    expect(result.current.showPending).toBe(true);
    act(() => vi.advanceTimersByTime(50));
    expect(result.current.isSlow).toBe(true);
    unmount();
    await act(async () => {});
    vi.useRealTimers();
  });

  it('updates selected navigation immediately without replacing committed content', async () => {
    const request = deferred<string>();
    const { result } = renderHook(() =>
      useNavigation(() => request.promise, {
        initial: { destination: '/home', data: 'Home' },
      }),
    );
    act(() => {
      void result.current.navigate('/settings');
    });
    expect(result.current.selected).toBe('/settings');
    expect(result.current.current).toBe('/home');
    await act(async () => {
      request.resolve('Settings');
    });
    expect(result.current.current).toBe('/settings');
  });

  it('renders optimistic data and recovers after rejection', async () => {
    const request = deferred<number>();
    const { result } = renderHook(() =>
      useMutation((_: number) => request.promise, {
        initialData: 1,
        optimistic: (n, delta) => n + delta,
      }),
    );
    act(() => {
      void result.current.run(1);
    });
    expect(result.current.data).toBe(2);
    await act(async () => {
      request.reject(Error('offline'));
    });
    expect(result.current.data).toBe(1);
    expect(result.current.status).toBe('error');
  });

  it('renders stable initial content on the server', () => {
    function ServerExample() {
      const task = useTask(async () => 'new', { initialData: 'initial' });
      return <p>{task.data}</p>;
    }
    expect(renderToString(<ServerExample />)).toBe('<p>initial</p>');
  });

  it('keeps the live region mounted as feedback changes', () => {
    const { getByRole, rerender } = render(
      <Pending state={{ showPending: false, isSlow: false }}>Loading</Pending>,
    );
    const region = getByRole('status');
    expect(region.textContent).toBe('');
    rerender(
      <Pending state={{ showPending: true, isSlow: true }} slow="Still working">
        Loading
      </Pending>,
    );
    expect(getByRole('status')).toBe(region);
    expect(region.textContent).toBe('Still working');
  });
});
