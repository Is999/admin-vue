import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const layoutSource = readFileSync(
  resolve(process.cwd(), 'apps/web-antd/src/layouts/basic.vue'),
  'utf8',
);

describe('basic layout header quick actions', () => {
  it.each([
    ['120', 'ThemeToggle'],
    ['130', 'LanguageToggle'],
    ['140', 'TimezoneButton'],
  ])('keeps header-right-%s wired to %s', (index, component) => {
    expect(layoutSource).toContain(`<template #header-right-${index}>`);
    expect(layoutSource).toContain(`<${component}`);
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
