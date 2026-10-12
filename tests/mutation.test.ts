import { describe, expect, it, vi } from 'vitest';
import { createMutation } from '../src';
import { deferred } from './helpers';

describe('mutations', () => {
  it('projects immediately, then commits the authoritative response', async () => {
    const request = deferred<number>();
    const mutation = createMutation((_: number) => request.promise, {
      initialData: 1,
      optimistic: (n, amount) => n + amount,
    });
    const result = mutation.run(2);
    expect(mutation.getSnapshot()).toMatchObject({
      data: 3,
      confirmed: 1,
      isPending: true,
    });
    request.resolve(4);
    await result;
    expect(mutation.getSnapshot()).toMatchObject({
      data: 4,
      confirmed: 4,
      isPending: false,
    });
  });

  it('rolls back failed optimistic updates and preserves input for recovery', async () => {
    const request = deferred<string>();
    const mutation = createMutation((_: string) => request.promise, {
      initialData: 'before',
      optimistic: (_, next) => next,
    });
    const result = mutation.run('draft');
    request.reject(Error('offline'));
    await result;
    expect(mutation.getSnapshot()).toMatchObject({
      data: 'before',
      confirmed: 'before',
      input: 'draft',
      status: 'error',
    });
  });

  it('prevents double submission before React has time to render', async () => {
    const request = deferred<number>();
    const write = vi.fn((_: number) => request.promise);
    const mutation = createMutation(write, {
      initialData: 0,
      optimistic: (n, delta) => n + delta,
    });
    const first = mutation.run(1);
    expect(await mutation.run(100)).toEqual({ status: 'busy' });
    expect(mutation.getSnapshot().data).toBe(1);
    expect(write).toHaveBeenCalledTimes(1);
    request.resolve(1);
    await first;
  });

  it('rebases on external data and rolls back to the newest confirmed value', async () => {
    const request = deferred<number>();
    const mutation = createMutation((_: number) => request.promise, {
      initialData: 1,
      optimistic: (n, amount) => n + amount,
    });
    const result = mutation.run(2);
    mutation.reconcile(10);
    expect(mutation.getSnapshot()).toMatchObject({ data: 12, confirmed: 10 });
    request.reject(Error('conflict'));
    await result;
    expect(mutation.getSnapshot().data).toBe(10);
  });

  it('does not call the server if the optimistic reducer throws', async () => {
    const write = vi.fn(() => 1);
    const mutation = createMutation(write, {
      initialData: 0,
      optimistic: () => {
        throw Error('bad projection');
      },
    });
    expect((await mutation.run(undefined)).status).toBe('error');
    expect(write).not.toHaveBeenCalled();
    expect(mutation.getSnapshot().data).toBe(0);
  });

  it('can run another mutation after success', async () => {
    const mutation = createMutation((n: number) => n, { initialData: 0 });
    await mutation.run(1);
    await mutation.run(2);
    expect(mutation.getSnapshot().confirmed).toBe(2);
  });

  it('supports confirmed undefined values and stops work on disposal', async () => {
    const mutation = createMutation(() => undefined, {
      initialData: 1 as number | undefined,
    });
    await mutation.run(undefined);
    expect(mutation.getSnapshot().data).toBeUndefined();
    mutation.dispose();
    expect(await mutation.run(undefined)).toEqual({ status: 'disposed' });
  });
});
