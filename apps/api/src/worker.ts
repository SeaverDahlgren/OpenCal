import { loadConfig } from "../../../src/config/env.js";
import { ApiAuthService } from "./auth/service.js";
import { GoogleTokenStore } from "./auth/token-store.js";
import { JobProcessor } from "./jobs/processor.js";
import { JobStore } from "./jobs/store.js";
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

  const result = await processor.processNext();
  if (!result) {
    console.log("No pending jobs.");
    return;
  }
  console.log(`Processed job ${result.jobId}: ${result.status}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
