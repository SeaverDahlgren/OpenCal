import { describe, expect, it } from "vitest";
import { parseWorkerOptions } from "../apps/api/src/jobs/worker-runner.js";

describe("worker runner", () => {
  it("parses one-shot mode by default", () => {
    expect(parseWorkerOptions([], 5000)).toEqual({
      watch: false,
      pollIntervalMs: 5000,
    });
  });

  it("parses watch mode", () => {
    expect(parseWorkerOptions(["--watch"], 2500)).toEqual({
      watch: true,
      pollIntervalMs: 2500,
    });
  });
});
