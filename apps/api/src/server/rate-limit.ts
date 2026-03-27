type Entry = {
  count: number;
  resetAt: number;
  lastSeenAt: number;
};

export class InMemoryRateLimiter {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly windowMs: number,
    private readonly maxRequests: number,
    private readonly maxKeys: number,
  ) {}

  check(key: string, now = Date.now()) {
    this.pruneExpired(now);
    const current = this.entries.get(key);
    if (!current || current.resetAt <= now) {
      const resetAt = now + this.windowMs;
      this.evictOverflow(now);
      this.entries.set(key, { count: 1, resetAt, lastSeenAt: now });
      return {
        allowed: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - 1,
        resetAt,
      } as const;
    }

    current.lastSeenAt = now;
    if (current.count >= this.maxRequests) {
      return {
        allowed: false,
        limit: this.maxRequests,
        remaining: 0,
        resetAt: current.resetAt,
      } as const;
    }

    current.count += 1;
    this.entries.set(key, current);
    return {
      allowed: true,
      limit: this.maxRequests,
      remaining: Math.max(this.maxRequests - current.count, 0),
      resetAt: current.resetAt,
    } as const;
  }

  size() {
    return this.entries.size;
  }

  private pruneExpired(now: number) {
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) {
        this.entries.delete(key);
      }
    }
  }

  private evictOverflow(now: number) {
    if (this.entries.size < this.maxKeys) {
      return;
    }
    this.pruneExpired(now);
    if (this.entries.size < this.maxKeys) {
      return;
    }
    const overflow = this.entries.size - this.maxKeys + 1;
    const staleKeys = [...this.entries.entries()]
      .sort(([, left], [, right]) => {
        if (left.resetAt !== right.resetAt) {
          return left.resetAt - right.resetAt;
        }
        return left.lastSeenAt - right.lastSeenAt;
      })
      .slice(0, overflow)
      .map(([key]) => key);
    for (const key of staleKeys) {
      this.entries.delete(key);
    }
  }
}
