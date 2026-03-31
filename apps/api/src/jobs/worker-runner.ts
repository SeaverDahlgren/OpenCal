import type { JobProcessor } from "./processor.js";

export type WorkerOptions = {
  watch: boolean;
  pollIntervalMs: number;
};

export async function runWorker(processor: JobProcessor, options: WorkerOptions, signal?: AbortSignal) {
  if (!options.watch) {
    return await processor.processNext();
  }

  while (!signal?.aborted) {
    const result = await processor.processNext();
    if (result) {
      console.log(`Processed job ${result.jobId}: ${result.status}`);
      continue;
    }
    await sleep(options.pollIntervalMs, signal);
  }
  return null;
}

export function parseWorkerOptions(argv: string[], pollIntervalMs: number): WorkerOptions {
  return {
    watch: argv.includes("--watch"),
    pollIntervalMs,
  };
}

function sleep(ms: number, signal?: AbortSignal) {
  if (signal?.aborted) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      resolve(undefined);
    };
    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort);
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve(undefined);
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
