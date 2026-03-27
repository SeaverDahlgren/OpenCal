import { describe, expect, it } from "vitest";
import { InMemoryRateLimiter } from "../apps/api/src/server/rate-limit.js";

describe("in-memory rate limiter", () => {
  it("allows requests until the limit and then blocks", () => {
    const limiter = new InMemoryRateLimiter(60_000, 2);

    expect(limiter.check("key-1", 1000)).toMatchObject({
      allowed: true,
      remaining: 1,
    });
    expect(limiter.check("key-1", 1001)).toMatchObject({
      allowed: true,
      remaining: 0,
    });
    expect(limiter.check("key-1", 1002)).toMatchObject({
      allowed: false,
      remaining: 0,
    });
  });

  it("resets usage when the window expires", () => {
    const limiter = new InMemoryRateLimiter(100, 1);

    expect(limiter.check("key-1", 1000).allowed).toBe(true);
    expect(limiter.check("key-1", 1001).allowed).toBe(false);
    expect(limiter.check("key-1", 1201)).toMatchObject({
      allowed: true,
      remaining: 0,
    });
  });
});
