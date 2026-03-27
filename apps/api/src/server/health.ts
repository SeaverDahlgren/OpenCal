import type { AppConfig } from "../../../../src/config/env.js";
import type { JobRecord } from "../jobs/types.js";

export function buildReadyPayload(config: AppConfig, jobs: JobRecord[]) {
  const counts = summarizeJobs(jobs);
  return {
    status: counts.exhausted > 0 ? "degraded" : "ready",
    service: "opencal-api",
    environment: config.appEnv,
    storageBackend: config.storageBackend,
    jobBackend: config.jobBackend,
    minSupportedAppVersion: config.minSupportedAppVersion,
    jobs: counts,
  };
}

function summarizeJobs(jobs: JobRecord[]) {
  return jobs.reduce(
    (summary, job) => {
      summary.total += 1;
      summary[job.status] += 1;
      return summary;
    },
    {
      total: 0,
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      exhausted: 0,
    },
  );
}
