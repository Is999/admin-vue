import { describe, expect, it } from 'vitest';

import { buildSignString, encodeCipherHeader } from '../signature';
import securityVectors from './testdata/security-vectors.json';

interface SecurityVectorFile {
  version: number;
  signVectors: Array<{
    appID: string;
    data: Record<string, any>;
    expected: string;
    fields: string[];
    name: string;
    timestamp: string;
    traceID: string;
  }>;
  cipherHeaderVectors: Array<{
    expected: string;
    fields: string[];
    name: string;
  }>;
  fieldLimitVectors: Array<{
    fields: string[];
    name: string;
    shouldReject: boolean;
  }>;
}

function loadSecurityVectors() {
  const vectors = securityVectors as SecurityVectorFile;
  expect(vectors.version).toBe(1);
  return vectors;
}

describe('security vectors', () => {
  const vectors = loadSecurityVectors();

  it.each(vectors.signVectors)(
    'builds backend-compatible sign string: $name',
    (vector) => {
      expect(
        buildSignString(
          vector.data,
          vector.fields,
          vector.traceID,
          vector.timestamp,
          vector.appID,
        ),
      ).toBe(vector.expected);
    },
  );

  it.each(vectors.cipherHeaderVectors)(
    'encodes backend-compatible X-Cipher header: $name',
    (vector) => {
      expect(encodeCipherHeader(vector.fields)).toBe(vector.expected);
    },
  );

  it.each(vectors.fieldLimitVectors)(
    'keeps field count limit vector: $name',
    (vector) => {
      const run = () => encodeCipherHeader(vector.fields);
      if (vector.shouldReject) {
        expect(run).toThrow(/securityFieldCountTooLarge/);
      } else {
        expect(run).not.toThrow();
      }
    },
  );
});
