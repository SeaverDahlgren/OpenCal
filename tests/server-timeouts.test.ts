import { describe, expect, it } from "vitest";
import { applyServerTimeouts } from "../apps/api/src/server/timeouts.js";

describe("server timeouts", () => {
  it("applies explicit request, header, and keep-alive timeouts", () => {
    const server = {
      requestTimeout: 0,
      headersTimeout: 0,
      keepAliveTimeout: 0,
    };

    applyServerTimeouts(server, {
      apiRequestTimeoutMs: 30000,
      apiHeadersTimeoutMs: 15000,
      apiKeepAliveTimeoutMs: 5000,
    });

    expect(server.requestTimeout).toBe(30000);
    expect(server.headersTimeout).toBe(15000);
    expect(server.keepAliveTimeout).toBe(5000);
  });
});
