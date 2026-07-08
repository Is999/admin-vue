import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const layoutSource = readFileSync(
  resolve(process.cwd(), 'apps/web-antd/src/layouts/basic.vue'),
  'utf8',
);
const preferencesButtonSource = readFileSync(
  resolve(
    process.cwd(),
    'packages/effects/layouts/src/widgets/preferences/preferences-button.vue',
  ),
  'utf8',
);

describe('basic layout header quick actions', () => {
  it('leaves preference-controlled header widgets to the core layout', () => {
    expect(layoutSource).not.toContain('<template #header-right-120>');
    expect(layoutSource).not.toContain('<template #header-right-130>');
    expect(layoutSource).not.toContain('<template #header-right-140>');
  });

  it('opens the preferences drawer from the header settings button', () => {
    expect(preferencesButtonSource).toContain('ref="preferencesRef"');
    expect(preferencesButtonSource).toContain('@click="openPreferences"');
    expect(preferencesButtonSource).toContain('preferencesRef.value?.open()');
  });

  it('binds the header lock action to the lock-screen preference', () => {
    expect(layoutSource).toContain('if (!preferences.widget.lockScreen)');
    expect(layoutSource).toContain('() => preferences.widget.lockScreen');
    expect(layoutSource).toContain('v-if="preferences.widget.lockScreen"');
  });

  it('pauses authenticated notification polling while reauthentication is open', () => {
    expect(layoutSource).toContain('if (!accessStore.accessToken)');
    expect(layoutSource).toContain('fetchAdminMessageNotifications');
  });

  it('recreates the login form whenever the expired-session modal reopens', () => {
    expect(layoutSource).toContain('loginFormKey.value += 1');
    expect(layoutSource).toContain('<LoginForm :key="loginFormKey" />');
  });

  it('does not clear the next account notifications after a delayed request', () => {
    expect(layoutSource).toContain(
      'if (sessionIdentity !== currentSessionStateIdentity())',
    );
  });
});
