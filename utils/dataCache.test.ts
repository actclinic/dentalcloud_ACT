import { describe, expect, it, beforeEach } from 'vitest';
import { dataCache, cacheKey } from './dataCache';

describe('dataCache', () => {
  beforeEach(() => {
    dataCache.clear();
  });

  it('stores and retrieves data', () => {
    dataCache.set('test-key', { name: 'John' });
    expect(dataCache.get('test-key')).toEqual({ name: 'John' });
  });

  it('returns null for missing key', () => {
    expect(dataCache.get('nonexistent')).toBeNull();
  });

  it('expires entries after TTL', async () => {
    dataCache.set('expiring-key', 'hello', 10); // 10ms TTL
    expect(dataCache.get('expiring-key')).toBe('hello');
    await new Promise((r) => setTimeout(r, 15));
    expect(dataCache.get('expiring-key')).toBeNull();
  });

  it('invalidates a specific key', () => {
    dataCache.set('key-a', 1);
    dataCache.set('key-b', 2);
    dataCache.invalidate('key-a');
    expect(dataCache.get('key-a')).toBeNull();
    expect(dataCache.get('key-b')).toBe(2);
  });

  it('invalidates by prefix', () => {
    dataCache.set('patients:loc-1', [1, 2]);
    dataCache.set('patients:loc-2', [3, 4]);
    dataCache.set('appointments:loc-1', [5]);
    dataCache.invalidatePrefix('patients:');
    expect(dataCache.get('patients:loc-1')).toBeNull();
    expect(dataCache.get('patients:loc-2')).toBeNull();
    expect(dataCache.get('appointments:loc-1')).toEqual([5]);
  });

  it('clears all entries', () => {
    dataCache.set('a', 1);
    dataCache.set('b', 2);
    dataCache.clear();
    expect(dataCache.get('a')).toBeNull();
    expect(dataCache.get('b')).toBeNull();
  });
});

describe('cacheKey', () => {
  it('builds key with location id', () => {
    expect(cacheKey('patients', 'loc-123')).toBe('patients:loc-123');
  });

  it('builds key without location id', () => {
    expect(cacheKey('locations')).toBe('locations');
  });
});
