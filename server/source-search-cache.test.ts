import { describe, expect, it, vi } from "vitest";
import { createTimedAsyncCache } from "./source-search-cache";

describe("timed async source cache", () => {
  it("returns fresh values without repeating the external lookup", async () => {
    let now = 1_000;
    const cache = createTimedAsyncCache<string>({ freshTtlMs: 100, staleTtlMs: 500, maxEntries: 10, now: () => now });
    const loader = vi.fn(() => "catalogs-v1");

    expect(await cache.get("milk:1", loader)).toBe("catalogs-v1");
    now += 99;
    expect(await cache.get("milk:1", loader)).toBe("catalogs-v1");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("coalesces concurrent misses for the same query/category key", async () => {
    const cache = createTimedAsyncCache<string>({ freshTtlMs: 100, staleTtlMs: 500, maxEntries: 10 });
    let resolveLookup!: (value: string) => void;
    const pending = new Promise<string>(resolve => { resolveLookup = resolve; });
    const loader = vi.fn(() => pending);

    const first = cache.get("milk:1", loader);
    const second = cache.get("milk:1", loader);
    expect(loader).toHaveBeenCalledTimes(1);
    resolveLookup("shared-result");
    await expect(Promise.all([first, second])).resolves.toEqual(["shared-result", "shared-result"]);
  });

  it("serves a stale value immediately and refreshes it in the background", async () => {
    let now = 0;
    const cache = createTimedAsyncCache<string>({ freshTtlMs: 100, staleTtlMs: 500, maxEntries: 10, now: () => now });
    await cache.get("milk:1", () => "old-result");
    now = 101;
    let finishRefresh!: (value: string) => void;
    const refresh = new Promise<string>(resolve => { finishRefresh = resolve; });
    const loader = vi.fn(() => refresh);

    await expect(cache.get("milk:1", loader)).resolves.toBe("old-result");
    expect(loader).toHaveBeenCalledTimes(1);
    finishRefresh("new-result");
    await new Promise(resolve => setTimeout(resolve, 0));
    await expect(cache.get("milk:1", () => "unexpected")).resolves.toBe("new-result");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("evicts least-recently-used keys when the cache reaches its limit", async () => {
    const cache = createTimedAsyncCache<string>({ freshTtlMs: 1_000, staleTtlMs: 0, maxEntries: 2 });
    const loadA = vi.fn(() => "A");
    const loadB = vi.fn(() => "B");
    const loadC = vi.fn(() => "C");

    await cache.get("a", loadA);
    await cache.get("b", loadB);
    await cache.get("a", loadA); // A is now the most recently used.
    await cache.get("c", loadC); // B is evicted.
    await cache.get("a", loadA);
    await cache.get("b", loadB);

    expect(loadA).toHaveBeenCalledTimes(1);
    expect(loadB).toHaveBeenCalledTimes(2);
    expect(cache.size).toBe(2);
  });
});
