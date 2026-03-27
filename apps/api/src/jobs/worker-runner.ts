import type { JobProcessor } from "./processor.js";

export type WorkerOptions = {
  watch: boolean;
  pollIntervalMs: number;
};

export async function runWorker(processor: JobProcessor, options: WorkerOptions) {
  if (!options.watch) {
    return await processor.processNext();
  }

  while (true) {
    const result = await processor.processNext();
    if (result) {
      console.log(`Processed job ${result.jobId}: ${result.status}`);
      continue;
    }
    await sleep(options.pollIntervalMs);
  }
}

export function parseWorkerOptions(argv: string[], pollIntervalMs: number): WorkerOptions {
  return {
    watch: argv.includes("--watch"),
    pollIntervalMs,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
