import { describe, expect, it } from 'vitest';

import { resolveDisplayFileURL, resolveSafeFilePreviewURL } from './image';

describe('resolveDisplayFileURL', () => {
  it('resolves relative and HTTP(S) image addresses', () => {
    expect(
      resolveDisplayFileURL('file/avatar.png', 'https://admin.example/api/'),
    ).toBe('https://admin.example/api/file/avatar.png');
    expect(resolveDisplayFileURL('https://cdn.example/avatar.webp')).toBe(
      'https://cdn.example/avatar.webp',
    );
  });

  it('allows only raster image data URLs', () => {
    expect(resolveDisplayFileURL('data:image/png;base64,AAAA')).toBe(
      'data:image/png;base64,AAAA',
    );
    expect(resolveDisplayFileURL('data:text/html;base64,PHNjcmlwdD4=')).toBe(
      '',
    );
    expect(resolveDisplayFileURL('data:image/svg+xml,<svg></svg>')).toBe('');
  });

  it('rejects executable and unsupported URL protocols', () => {
    expect(resolveDisplayFileURL('javascript:alert(1)')).toBe('');
    expect(resolveDisplayFileURL('ftp://cdn.example/avatar.png')).toBe('');
    expect(resolveDisplayFileURL('http://[')).toBe('');
  });

  it('requires objectKey for managed file access URLs', () => {
    expect(
      resolveDisplayFileURL(
        '/api/file-transfer/access',
        'https://admin.example',
      ),
    ).toBe('');
    expect(
      resolveDisplayFileURL(
        '/api/file-transfer/access?objectKey=admin-avatar%2F202607%2F16%2Favatar.png',
        'https://admin.example',
      ),
    ).toBe(
      'https://admin.example/api/file-transfer/access?objectKey=admin-avatar%2F202607%2F16%2Favatar.png',
    );
  });
});

describe('resolveSafeFilePreviewURL', () => {
  it('allows relative, HTTP(S), and local Blob previews', () => {
    expect(
      resolveSafeFilePreviewURL('report.pdf', 'https://admin.example/files/'),
    ).toBe('https://admin.example/files/report.pdf');
    expect(resolveSafeFilePreviewURL('blob:https://admin.example/id-1')).toBe(
      'blob:https://admin.example/id-1',
    );
  });

  it('rejects executable and embedded document URLs', () => {
    expect(resolveSafeFilePreviewURL('javascript:alert(1)')).toBe('');
    expect(resolveSafeFilePreviewURL('data:text/html,<script></script>')).toBe(
      '',
    );
  });
});
