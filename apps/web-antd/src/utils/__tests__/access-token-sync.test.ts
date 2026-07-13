import { useAccessStore } from '@vben/stores';

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { applyAccessTokenRotation } from '../access-token-sync';
import {
  currentSessionStateVersion,
  runSessionTransition,
} from '../session-state-gate';

describe('access token synchronization', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('updates the matching token without changing account identity', async () => {
    const accessStore = useAccessStore();
    accessStore.setAccessToken('old-token');
    const version = currentSessionStateVersion();

    await expect(
      applyAccessTokenRotation({
        nextToken: 'renewed-token',
        sourceToken: 'old-token',
        type: 'rotate',
      }),
    ).resolves.toBe(true);

    expect(accessStore.accessToken).toBe('renewed-token');
    expect(currentSessionStateVersion()).toBe(version);
  });

  it('ignores a rotation broadcast from a previous account', async () => {
    const accessStore = useAccessStore();
    await runSessionTransition(() => {
      accessStore.setAccessToken('new-account-token');
    });

    await expect(
      applyAccessTokenRotation({
        nextToken: 'old-account-renewed-token',
        sourceToken: 'old-account-token',
        type: 'rotate',
      }),
    ).resolves.toBe(false);
    expect(accessStore.accessToken).toBe('new-account-token');
  });
});
