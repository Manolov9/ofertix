export type TimedAsyncCacheOptions = {
  /** How long a cached value is considered fresh. */
  freshTtlMs: number;
  /** How long to keep serving stale data while a background refresh runs. */
  staleTtlMs: number;
  /** Maximum number of query/category keys retained in memory. */
  maxEntries: number;
  now?: () => number;
};

type CacheEntry<T> = {
  value: T;
  freshUntil: number;
  staleUntil: number;
};

/**
 * Small process-local cache for async source lookups. Fresh hits return directly;
 * stale hits return immediately and refresh in the background. Concurrent misses
 * for the same key share one loader promise, and old keys are evicted LRU-first.
 */
export function createTimedAsyncCache<T>(options: TimedAsyncCacheOptions) {
  const freshTtlMs = Math.max(0, options.freshTtlMs);
  const staleTtlMs = Math.max(0, options.staleTtlMs);
  const maxEntries = Math.max(1, Math.floor(options.maxEntries));
  const now = options.now ?? Date.now;
  const entries = new Map<string, CacheEntry<T>>();
  const inFlight = new Map<string, Promise<T>>();

  const touch = (key: string, entry: CacheEntry<T>) => {
    entries.delete(key);
    entries.set(key, entry);
  };

  const store = (key: string, value: T) => {
    const timestamp = now();
    entries.delete(key);
    entries.set(key, {
      value,
      freshUntil: timestamp + freshTtlMs,
      staleUntil: timestamp + freshTtlMs + staleTtlMs,
    });
    while (entries.size > maxEntries) {
      const oldestKey = entries.keys().next().value as string | undefined;
      if (oldestKey === undefined) break;
      entries.delete(oldestKey);
    }
  };

  const refresh = (key: string, loader: () => Promise<T> | T): Promise<T> => {
    const existing = inFlight.get(key);
    if (existing) return existing;

    let loaded: Promise<T>;
    try {
      loaded = Promise.resolve(loader());
    } catch (error) {
      loaded = Promise.reject(error);
    }

    let request: Promise<T>;
    request = loaded
      .then(value => {
        store(key, value);
        return value;
      })
      .finally(() => {
        if (inFlight.get(key) === request) inFlight.delete(key);
      });
    inFlight.set(key, request);
    return request;
  };

  return {
    async get(key: string, loader: () => Promise<T> | T): Promise<T> {
      const entry = entries.get(key);
      if (entry) {
        touch(key, entry);
        const timestamp = now();
        if (timestamp < entry.freshUntil) return entry.value;
        if (timestamp < entry.staleUntil) {
          void refresh(key, loader).catch(() => undefined);
          return entry.value;
        }
      }
      return refresh(key, loader);
    },
    clear() {
      entries.clear();
      inFlight.clear();
    },
    get size() {
      return entries.size;
    },
  };
}
