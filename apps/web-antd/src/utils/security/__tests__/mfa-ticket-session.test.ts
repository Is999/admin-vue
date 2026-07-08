// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runSessionTransition } from '../../session-state-gate';
import { requestMfaTwoStep, submitWithMfaRetry } from '../mfa';

const mocks = vi.hoisted(() => ({
  createMfaOverlayDialog: vi.fn(),
}));

vi.mock('../mfa-overlay', () => ({
  createMfaOverlayDialog: mocks.createMfaOverlayDialog,
}));
vi.mock('#/api', () => ({
  checkMfaSecureApi: vi.fn(),
}));
vi.mock('#/api/system', () => ({
  fetchProfileInfo: vi.fn(),
  refreshProfileMfaSecretKey: vi.fn(),
}));
vi.mock('#/locales', () => ({
  $t: (key: string) => key,
}));

function resolvedDialog(ticketValue: string) {
  return {
    destroy: vi.fn(),
    promise: Promise.resolve({
      result: {
        isOk: true,
        scenarios: 2,
        twoStep: {
          expire: 60,
          key: 'ticket-key',
          time: Date.now(),
          value: ticketValue,
        },
      },
      secure: '123456',
    }),
  };
}

describe('mfa ticket session isolation', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    vi.clearAllMocks();
    await runSessionTransition(() => undefined);
  });

  it('reuses a ticket only within the identity that obtained it', async () => {
    mocks.createMfaOverlayDialog.mockReturnValueOnce(
      resolvedDialog('first-ticket'),
    );

    await expect(requestMfaTwoStep(2)).resolves.toMatchObject({
      value: 'first-ticket',
    });
    await expect(requestMfaTwoStep(2)).resolves.toMatchObject({
      value: 'first-ticket',
    });
    expect(mocks.createMfaOverlayDialog).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('admin:mfa-two-step-ticket')).toBeNull();

    await runSessionTransition(() => undefined);
    expect(sessionStorage.getItem('admin:mfa-two-step-ticket')).toBeNull();
    mocks.createMfaOverlayDialog.mockReturnValueOnce(
      resolvedDialog('second-ticket'),
    );

    await expect(requestMfaTwoStep(2)).resolves.toMatchObject({
      value: 'second-ticket',
    });
    expect(mocks.createMfaOverlayDialog).toHaveBeenCalledTimes(2);
  });

  it('does not replay a sensitive operation after the account changes', async () => {
    let resolveDialog: (value: any) => void = () => {};
    mocks.createMfaOverlayDialog.mockReturnValueOnce({
      destroy: vi.fn(),
      promise: new Promise((resolve) => {
        resolveDialog = resolve;
      }),
    });
    const submit = vi.fn().mockRejectedValueOnce({ code: 8 });

    const pending = submitWithMfaRetry(2, submit, 'verify', {
      loadProfileContext: false,
    });
    await vi.waitFor(() => {
      expect(mocks.createMfaOverlayDialog).toHaveBeenCalledTimes(1);
    });

    await runSessionTransition(() => undefined);
    resolveDialog({
      result: {
        isOk: true,
        scenarios: 2,
        twoStep: {
          expire: 60,
          key: 'ticket-key',
          time: Date.now(),
          value: 'old-session-ticket',
        },
      },
      secure: '123456',
    });

    await expect(pending).rejects.toThrow('SESSION_STATE_CHANGED');
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
