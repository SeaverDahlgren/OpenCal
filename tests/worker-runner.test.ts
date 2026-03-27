import { describe, expect, it } from "vitest";
import { parseWorkerOptions, runWorker } from "../apps/api/src/jobs/worker-runner.js";

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

  it("stops watch mode when the abort signal is already set", async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await runWorker(
      {
        processNext: async () => {
          throw new Error("should not run");
        },
      } as never,
      { watch: true, pollIntervalMs: 2500 },
      controller.signal,
    );

    expect(result).toBeNull();
  });
});
