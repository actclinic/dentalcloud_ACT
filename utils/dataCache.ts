/**
 * Simple in-memory data cache with TTL.
 * Reduces redundant Supabase API calls when switching views
 * or performing rapid branch switches within a short time window.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 30_000; // 30 seconds

const cache = new Map<string, CacheEntry<any>>();

export const dataCache = {
  get<T>(key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      cache.delete(key);
      return null;
    }
    return entry.data as T;
  },

  set<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
    cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  },

  /** Remove a specific cache key (e.g. after a mutation) */
  invalidate(key: string): void {
    cache.delete(key);
  },

  /** Remove all cache entries whose key starts with the given prefix */
  invalidatePrefix(prefix: string): void {
    for (const key of cache.keys()) {
      if (key.startsWith(prefix)) {
        cache.delete(key);
      }
    }
  },

  /** Clear the entire cache (e.g. on logout or branch change) */
  clear(): void {
    cache.clear();
  },
};

/**
 * Build a cache key from a prefix and optional location id.
 * Example: cacheKey('patients', 'loc-abc') -> 'patients:loc-abc'
 */
export const cacheKey = (prefix: string, locationId?: string): string =>
  locationId ? `${prefix}:${locationId}` : prefix;
