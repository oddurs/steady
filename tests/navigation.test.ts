import { describe, expect, it } from 'vitest';
import { createNavigation } from '../src';
import { deferred } from './helpers';

describe('navigation', () => {
  it('separates selected intent from committed content', async () => {
    const request = deferred<string>();
    const navigation = createNavigation(() => request.promise, {
      initial: { destination: '/home', data: 'Home' },
    });
    const result = navigation.navigate('/settings');
    expect(navigation.getSnapshot()).toMatchObject({
      selected: '/settings',
      current: '/home',
      data: { data: 'Home' },
    });
    request.resolve('Settings');
    await result;
    expect(navigation.getSnapshot()).toMatchObject({
      selected: '/settings',
      current: '/settings',
      data: { data: 'Settings' },
    });
  });

  it('rolls selection back after failure and retries the requested destination', async () => {
    let fails = true;
    const navigation = createNavigation(
      async (path) => {
        if (fails) throw Error('offline');
        return path;
      },
      { initial: { destination: '/home', data: 'Home' } },
    );
    await navigation.navigate('/settings');
    expect(navigation.getSnapshot()).toMatchObject({
      selected: '/home',
      current: '/home',
      status: 'error',
      input: '/settings',
    });
    fails = false;
    await navigation.retry();
    expect(navigation.getSnapshot().current).toBe('/settings');
  });

  it('honors the latest destination despite out-of-order completions', async () => {
    const settings = deferred<string>();
    const billing = deferred<string>();
    const navigation = createNavigation(
      (path) => (path === '/settings' ? settings.promise : billing.promise),
      { initial: { destination: '/home', data: 'Home' } },
    );
    const first = navigation.navigate('/settings');
    const second = navigation.navigate('/billing');
    expect(await first).toEqual({ status: 'superseded' });
    billing.resolve('Billing');
    await second;
    settings.resolve('Settings');
    await Promise.resolve();
    expect(navigation.getSnapshot()).toMatchObject({
      selected: '/billing',
      current: '/billing',
    });
  });

  it('restores committed selection when cancelled', async () => {
    const navigation = createNavigation(() => new Promise<string>(() => {}), {
      initial: { destination: '/', data: 'Home' },
    });
    const result = navigation.navigate('/away');
    navigation.cancel();
    await result;
    expect(navigation.getSnapshot().selected).toBe('/');
    navigation.dispose();
  });
});
