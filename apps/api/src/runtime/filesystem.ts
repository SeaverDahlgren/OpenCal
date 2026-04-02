import fs from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../../../../src/config/env.js";

export async function ensureHostedRuntimeDirs(config: AppConfig) {
  await fs.mkdir(config.privateDir, { recursive: true });
  await fs.mkdir(path.join(config.privateDir, "logs"), { recursive: true });
}

export function hostedDebugLogPath(config: AppConfig, date = new Date()) {
  return path.join(config.privateDir, "logs", `${date.toISOString().slice(0, 10)}.log`);
}
