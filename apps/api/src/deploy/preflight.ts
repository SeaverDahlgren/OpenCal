import type { AppConfig } from "../../../../src/config/env.js";

export type PreflightReport = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  notes: string[];
};

export function buildPreflightReport(config: AppConfig): PreflightReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];

  if (config.appEnv === "production") {
    notes.push("Production mode enabled.");
    if (config.storageBackend !== "postgres") {
      errors.push("Production should use STORAGE_BACKEND=postgres.");
    } else {
      errors.push("Postgres storage adapters are not implemented yet.");
    }
    if (config.jobBackend !== "redis") {
      errors.push("Production should use JOB_BACKEND=redis.");
    } else {
      errors.push("Redis job backends are not implemented yet.");
    }
    if (!config.minSupportedAppVersion) {
      errors.push("Production requires MIN_SUPPORTED_APP_VERSION.");
    }
  } else if (config.appEnv === "staging") {
    notes.push("Staging mode enabled.");
    if (config.betaAccessMode !== "allowlist") {
      warnings.push("Staging should use BETA_ACCESS_MODE=allowlist for a controlled beta pool.");
    }
    if (config.storageBackend === "file") {
      warnings.push("Staging is still using file-backed storage.");
    }
    if (config.jobBackend === "file") {
      warnings.push("Staging is still using a file-backed job queue.");
    }
  } else {
    notes.push("Development mode enabled.");
  }

  if (config.betaAccessMode === "allowlist" && config.betaUserEmails.length === 0) {
    warnings.push("BETA_ACCESS_MODE=allowlist is set, but BETA_USER_EMAILS is empty.");
  }
  if (!config.adminApiKey) {
    warnings.push("ADMIN_API_KEY is unset. Support endpoints remain disabled.");
  }
  if (config.allowedReturnToPrefixes.length === 0 && config.appEnv !== "development") {
    warnings.push("ALLOWED_RETURN_TO_PREFIXES is empty. Hosted deep-link return targets are not configured.");
  }
  if ((config.allowedWebOrigins?.length ?? 0) === 0 && config.appEnv !== "development") {
    warnings.push("ALLOWED_WEB_ORIGINS is empty. Hosted browser clients will fail CORS checks.");
  }
  if (config.googleApiRedirectUri.includes("127.0.0.1") || config.googleApiRedirectUri.includes("localhost")) {
    warnings.push("GOOGLE_OAUTH_API_REDIRECT_URI still points at localhost.");
  }
  if (config.maxRequestBodyBytes > 2 * 1024 * 1024) {
    warnings.push("MAX_REQUEST_BODY_BYTES is above 2 MiB.");
  }
  if (config.rateLimitMaxKeys < 1000) {
    warnings.push("RATE_LIMIT_MAX_KEYS is unusually low for a hosted beta.");
  }

  notes.push(`API version: ${config.apiVersion}`);
  notes.push(`Beta access mode: ${config.betaAccessMode}`);
  notes.push(`Storage backend: ${config.storageBackend}`);
  notes.push(`Job backend: ${config.jobBackend}`);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    notes,
  };
}
