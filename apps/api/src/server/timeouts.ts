import type http from "node:http";
import type { AppConfig } from "../../../../src/config/env.js";

type TimeoutServer = Pick<http.Server, "requestTimeout" | "headersTimeout" | "keepAliveTimeout">;

export function applyServerTimeouts(server: TimeoutServer, config: Pick<AppConfig, "apiRequestTimeoutMs" | "apiHeadersTimeoutMs" | "apiKeepAliveTimeoutMs">) {
  server.requestTimeout = config.apiRequestTimeoutMs;
  server.headersTimeout = config.apiHeadersTimeoutMs;
  server.keepAliveTimeout = config.apiKeepAliveTimeoutMs;
}
