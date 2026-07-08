import { beforeEach, vi } from 'vitest';

const isHttpUrl = (input: unknown): boolean => {
  if (typeof input === 'string') return /^https?:\/\//i.test(input);
  if (input instanceof URL) return /^https?:$/i.test(input.protocol);
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return /^https?:\/\//i.test(input.url);
  }
  return false;
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (input: unknown) => {
    if (isHttpUrl(input)) {
      throw new Error(`Network access is disabled in tests: ${String(input instanceof Request ? input.url : input)}`);
    }
    throw new Error('Network access is disabled in tests. Mock fetch explicitly for this test.');
  }));
});