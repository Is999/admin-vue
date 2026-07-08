import { describe, expect, it } from 'vitest';

import {
  messageContentText,
  normalizeMessageContentForSubmit,
  sanitizeMessageContentHtml,
} from './content';

describe('message content security', () => {
  it('removes executable markup and unsafe URLs', () => {
    const html = sanitizeMessageContentHtml(
      [
        '<script>alert(1)</script>',
        '<p onclick="alert(2)">safe</p>',
        '<a href="javascript:alert(3)" target="_self">link</a>',
        '<img src="data:text/html;base64,PHNjcmlwdD4=" onerror="alert(4)">',
      ].join(''),
    );

    expect(html).not.toMatch(/<script|onclick|onerror|javascript:|data:/i);
    expect(html).toContain('<p>safe</p>');
    expect(html).toContain(
      '<a target="_blank" rel="noopener noreferrer">link</a>',
    );
  });

  it('keeps only the supported style declarations', () => {
    const html = sanitizeMessageContentHtml(
      '<p style="color: #123456; position: fixed; background-image: url(javascript:alert(1)); text-align: center">styled</p>',
    );

    expect(html).toContain('color: #123456');
    expect(html).toContain('text-align: center');
    expect(html).not.toMatch(/position|background-image|url\(/i);
  });

  it('escapes plain text and derives a stable text summary', () => {
    const html = sanitizeMessageContentHtml('first < second\nthird');

    expect(html).toBe('first &lt; second<br>third');
    expect(messageContentText(html)).toBe('first < secondthird');
  });

  it('rejects visually empty content before submission', () => {
    expect(normalizeMessageContentForSubmit('<p><br></p>')).toBe('');
    expect(normalizeMessageContentForSubmit('<strong>notice</strong>')).toBe(
      '<strong>notice</strong>',
    );
  });
});
