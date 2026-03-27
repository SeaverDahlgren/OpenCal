import { loadConfig } from "../../../src/config/env.js";
import { ApiAuthService } from "./auth/service.js";
import { createRuntimeStores } from "./bootstrap/runtime.js";
import { JobProcessor } from "./jobs/processor.js";
import { parseWorkerOptions, runWorker } from "./jobs/worker-runner.js";

async function main() {
  const config = loadConfig(process.cwd());
  const { sessions, profiles, tokens, audit, jobs } = createRuntimeStores(config);
  const auth = new ApiAuthService(config, sessions, tokens, audit);
  const processor = new JobProcessor({
    config,
    auth,
    sessions,
    profiles,
    jobs,
  });
  const options = parseWorkerOptions(process.argv.slice(2), config.workerPollIntervalMs);

  const result = await runWorker(processor, options);
  if (!result) {
    console.log("No pending jobs.");
    return;
  }
  if (!options.watch) {
    console.log(`Processed job ${result.jobId}: ${result.status}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
