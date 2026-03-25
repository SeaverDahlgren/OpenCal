import { describe, expect, it } from "vitest";
import { findFreeWindows } from "../src/tools/time.js";

describe("findFreeWindows", () => {
  it("merges busy windows and returns slots over the minimum duration", () => {
    const freeWindows = findFreeWindows({
      rangeStart: "2026-03-25T09:00:00.000Z",
      rangeEnd: "2026-03-25T17:00:00.000Z",
      minDurationMinutes: 30,
      busyWindows: [
        {
          start: "2026-03-25T10:00:00.000Z",
          end: "2026-03-25T11:00:00.000Z",
        },
        {
          start: "2026-03-25T10:30:00.000Z",
          end: "2026-03-25T12:00:00.000Z",
        },
        {
          start: "2026-03-25T13:00:00.000Z",
          end: "2026-03-25T14:00:00.000Z",
        },
      ],
    });

    expect(freeWindows).toEqual([
      {
        start: "2026-03-25T09:00:00.000Z",
        end: "2026-03-25T10:00:00.000Z",
      },
      {
        start: "2026-03-25T12:00:00.000Z",
        end: "2026-03-25T13:00:00.000Z",
      },
      {
        start: "2026-03-25T14:00:00.000Z",
        end: "2026-03-25T17:00:00.000Z",
      },
    ]);
  });
});
