import { describe, expect, it } from "vitest";
import { InMemoryRateLimiter } from "../apps/api/src/server/rate-limit.js";

describe("in-memory rate limiter", () => {
  it("allows requests until the limit and then blocks", () => {
    const limiter = new InMemoryRateLimiter(60_000, 2, 100);

    expect(limiter.check("key-1", 1000)).toMatchObject({
      allowed: true,
      limit: 2,
      remaining: 1,
    });
    expect(limiter.check("key-1", 1001)).toMatchObject({
      allowed: true,
      limit: 2,
      remaining: 0,
    });
    expect(limiter.check("key-1", 1002)).toMatchObject({
      allowed: false,
      limit: 2,
      remaining: 0,
    });
  });

  it("resets usage when the window expires", () => {
    const limiter = new InMemoryRateLimiter(100, 1, 100);

    expect(limiter.check("key-1", 1000).allowed).toBe(true);
    expect(limiter.check("key-1", 1001).allowed).toBe(false);
    expect(limiter.check("key-1", 1201)).toMatchObject({
      allowed: true,
      remaining: 0,
    });
  });

  it("prunes expired keys before tracking new ones", () => {
    const limiter = new InMemoryRateLimiter(100, 1, 2);

    limiter.check("key-1", 1000);
    limiter.check("key-2", 1000);
    expect(limiter.size()).toBe(2);

    limiter.check("key-3", 1201);
    expect(limiter.size()).toBe(1);
  });

  it("evicts the stalest live key when max tracked keys is exceeded", () => {
    const limiter = new InMemoryRateLimiter(1_000, 10, 2);

    limiter.check("key-1", 1000);
    limiter.check("key-2", 1001);
    limiter.check("key-3", 1002);

    expect(limiter.size()).toBe(2);
    expect(limiter.check("key-1", 1003).allowed).toBe(true);
  });
});
