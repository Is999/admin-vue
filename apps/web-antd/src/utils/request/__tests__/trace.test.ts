import { describe, expect, it } from 'vitest';

import {
  createTraceparent,
  normalizeTraceId,
  TRACE_ID_HEADER,
  TRACEPARENT_HEADER,
} from '../trace';

describe('request trace utils', () => {
  it('should normalize uuid trace id to otel hex trace id', () => {
    // UUID 格式会被转换为后端 OTel 可直接识别的 32 位 trace_id。
    expect(normalizeTraceId('4bf92f35-77b3-4da6-a3ce-929d0e0e4736')).toBe(
      '4bf92f3577b34da6a3ce929d0e0e4736',
    );
  });

  it('should create w3c traceparent from trace id', () => {
    // traceparent 必须符合 W3C Trace Context: version-traceid-spanid-flags。
    const traceparent = createTraceparent('4bf92f3577b34da6a3ce929d0e0e4736');

    expect(traceparent).toMatch(
      /^00-4bf92f3577b34da6a3ce929d0e0e4736-[\da-f]{16}-01$/,
    );
  });

  it('should expose agreed trace header names', () => {
    // 常量名稳定后，签名、请求拦截器和错误提示都可以复用同一份定义。
    expect(TRACE_ID_HEADER).toBe('X-Trace-Id');
    expect(TRACEPARENT_HEADER).toBe('traceparent');
  });
});
