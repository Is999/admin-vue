import { describe, expect, it } from 'vitest';

import {
  currentSessionStateIdentity,
  currentSessionStateVersion,
  runSessionStateMutation,
  runSessionTransition,
} from '../session-state-gate';

describe('session state gate', () => {
  it('serializes route rebuild and account transition mutations', async () => {
    const events: string[] = [];
    let releaseRoute = () => {};
    const routeReady = new Promise<void>((resolve) => {
      releaseRoute = resolve;
    });
    const routeMutation = runSessionStateMutation(async () => {
      events.push('route:start');
      await routeReady;
      events.push('route:end');
    });
    const version = currentSessionStateVersion();
    const identity = currentSessionStateIdentity();
    const accountMutation = runSessionTransition(() => {
      events.push('account');
    });

    await Promise.resolve();
    expect(events).toEqual(['route:start']);
    releaseRoute();
    await Promise.all([routeMutation, accountMutation]);

    expect(events).toEqual(['route:start', 'route:end', 'account']);
    expect(currentSessionStateVersion()).toBe(version + 1);
    expect(currentSessionStateIdentity()).not.toBe(identity);
  });

  it('releases the next mutation after an error', async () => {
    const failed = runSessionStateMutation(() => {
      throw new Error('route failed');
    });
    const next = runSessionStateMutation(() => 'continued');

    await expect(failed).rejects.toThrow('route failed');
    await expect(next).resolves.toBe('continued');
  });
});
