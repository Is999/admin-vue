// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';

import {
  createMfaOverlayDialog,
  destroyAllMfaOverlayDialogs,
} from '../mfa-overlay';

afterEach(() => {
  destroyAllMfaOverlayDialogs();
  document.body.innerHTML = '';
  document.body.style.overflow = '';
});

describe('mfa overlay lifecycle', () => {
  it('rejects the pending promise when destroy is called', async () => {
    const dialog = createMfaOverlayDialog({
      cancelErrorMessage: 'session changed',
      onSubmit: async () => ({ ok: true }),
    });
    const pending = dialog.promise;

    dialog.destroy();

    await expect(pending).rejects.toThrow('session changed');
    expect(document.body.children).toHaveLength(0);
    expect(document.body.style.overflow).toBe('');
  });

  it('cancels all active overlays and restores body state', async () => {
    const first = createMfaOverlayDialog({
      cancelErrorMessage: 'first cancelled',
      onSubmit: async () => undefined,
    });
    const second = createMfaOverlayDialog({
      cancelErrorMessage: 'second cancelled',
      onSubmit: async () => undefined,
    });
    const firstPending = first.promise;
    const secondPending = second.promise;

    destroyAllMfaOverlayDialogs();

    await Promise.all([
      expect(firstPending).rejects.toThrow('first cancelled'),
      expect(secondPending).rejects.toThrow('second cancelled'),
    ]);
    expect(document.body.children).toHaveLength(0);
    expect(document.body.style.overflow).toBe('');
  });

  it('keeps body scrolling locked until the final overlay closes', async () => {
    document.body.style.overflow = 'auto';
    const first = createMfaOverlayDialog({
      cancelErrorMessage: 'first cancelled',
      onSubmit: async () => undefined,
    });
    const second = createMfaOverlayDialog({
      cancelErrorMessage: 'second cancelled',
      onSubmit: async () => undefined,
    });
    const firstPending = first.promise.catch((error) => error);
    const secondPending = second.promise.catch((error) => error);

    first.destroy();
    const firstError = await firstPending;
    expect(firstError.message).toBe('first cancelled');
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.children).toHaveLength(1);

    second.destroy();
    const secondError = await secondPending;
    expect(secondError.message).toBe('second cancelled');
    expect(document.body.style.overflow).toBe('auto');
    expect(document.body.children).toHaveLength(0);
  });
});
