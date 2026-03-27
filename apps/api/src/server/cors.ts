import type http from "node:http";
import type { AppConfig } from "../../../../src/config/env.js";

const DEFAULT_ALLOWED_HEADERS = [
  "authorization",
  "content-type",
  "idempotency-key",
  "x-opencal-app-version",
  "x-opencal-platform",
  "x-admin-key",
];

const DEFAULT_ALLOWED_METHODS = ["GET", "POST", "PATCH", "DELETE", "OPTIONS"];
const DEVELOPMENT_WEB_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

export function applyCorsHeaders(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: Pick<AppConfig, "appEnv" | "allowedWebOrigins">,
) {
  const origin = readOrigin(req);
  if (!origin || !isAllowedOrigin(origin, config)) {
    return false;
  }

  res.setHeader("vary", "origin");
  res.setHeader("access-control-allow-origin", origin);
  res.setHeader("access-control-allow-methods", DEFAULT_ALLOWED_METHODS.join(", "));
  res.setHeader("access-control-allow-headers", DEFAULT_ALLOWED_HEADERS.join(", "));
  res.setHeader("access-control-expose-headers", [
    "x-request-id",
    "x-opencal-api-version",
    "x-rate-limit-limit",
    "x-rate-limit-remaining",
    "x-rate-limit-reset",
    "retry-after",
  ].join(", "));
  res.setHeader("access-control-max-age", "86400");
  return true;
}

export function isAllowedOrigin(origin: string, config: Pick<AppConfig, "appEnv" | "allowedWebOrigins">) {
  return getAllowedOrigins(config).includes(origin);
}

function getAllowedOrigins(config: Pick<AppConfig, "appEnv" | "allowedWebOrigins">) {
  const configuredOrigins = config.allowedWebOrigins ?? [];
  if (config.appEnv === "development") {
    return [...new Set([...configuredOrigins, ...DEVELOPMENT_WEB_ORIGINS])];
  }
  return configuredOrigins;
}

function readOrigin(req: http.IncomingMessage) {
  const value = req.headers.origin;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
