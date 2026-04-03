import { describe, expect, it, vi } from "vitest";
import { buildRuntimeContext } from "../src/app/turn-engine-shared.js";

describe("buildRuntimeContext", () => {
  it("includes explicit local time in the requested timezone", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-03T15:50:00.000Z"));

    const runtime = buildRuntimeContext("America/Los_Angeles");

    expect(runtime.nowIso).toBe("2026-04-03T15:50:00.000Z");
    expect(runtime.dayOfWeek).toBe("Friday");
    expect(runtime.localNow).toBe("Friday, April 3, 2026 at 8:50 AM PDT");

    vi.useRealTimers();
  });
});
