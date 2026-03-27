import { loadConfig } from "../../../src/config/env.js";
import { ApiAuthService } from "./auth/service.js";
import { GoogleTokenStore } from "./auth/token-store.js";
import { JobProcessor } from "./jobs/processor.js";
import { JobStore } from "./jobs/store.js";
import { parseWorkerOptions, runWorker } from "./jobs/worker-runner.js";
import { SessionStore } from "./sessions/store.js";
import { UserProfileStore } from "./users/store.js";

async function main() {
  const config = loadConfig(process.cwd());
  const sessions = new SessionStore(config);
  const profiles = new UserProfileStore(config);
  const tokens = new GoogleTokenStore(config);
  const jobs = new JobStore(config);
  const auth = new ApiAuthService(config, sessions, tokens);
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
