type Entry = {
  count: number;
  resetAt: number;
};

export class InMemoryRateLimiter {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly windowMs: number,
    private readonly maxRequests: number,
  ) {}

  check(key: string, now = Date.now()) {
    const current = this.entries.get(key);
    if (!current || current.resetAt <= now) {
      const resetAt = now + this.windowMs;
      this.entries.set(key, { count: 1, resetAt });
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetAt,
      } as const;
    }

    if (current.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: current.resetAt,
      } as const;
    }

    current.count += 1;
    this.entries.set(key, current);
    return {
      allowed: true,
      remaining: Math.max(this.maxRequests - current.count, 0),
      resetAt: current.resetAt,
    } as const;
  }
}
