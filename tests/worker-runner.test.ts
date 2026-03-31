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

  it("does not accumulate abort listeners while polling in watch mode", async () => {
    const listeners = new Set<() => void>();
    const signal = {
      aborted: false,
      addEventListener: (_event: string, listener: () => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_event: string, listener: () => void) => {
        listeners.delete(listener);
      },
    } as unknown as AbortSignal;

    let polls = 0;
    const result = await runWorker(
      {
        processNext: async () => {
          polls += 1;
          if (polls >= 12) {
            (signal as { aborted: boolean }).aborted = true;
          }
          return null;
        },
      } as never,
      { watch: true, pollIntervalMs: 0 },
      signal,
    );

    expect(result).toBeNull();
    expect(polls).toBe(12);
    expect(listeners.size).toBe(0);
  });
});
