import { describe, expect, it } from 'vitest';

import { normalizeMfaSecure, resolveDialogErrorMessage } from '../mfa-guide';

describe('mfa guide helpers', () => {
  it('keeps only the first six MFA digits', () => {
    expect(normalizeMfaSecure(' 12a34-5678 ')).toBe('123456');
  });

  it('prefers backend business message over local fallback', () => {
    expect(
      resolveDialogErrorMessage(
        {
          response: {
            data: {
              message: '验证码错误',
            },
          },
        },
        '提交失败',
      ),
    ).toBe('验证码错误');
  });

  it('ignores axios 200 wrapper noise and uses fallback', () => {
    expect(
      resolveDialogErrorMessage(
        {
          message: 'Request failed with status code 200',
        },
        '提交失败',
      ),
    ).toBe('提交失败');
  });
});
