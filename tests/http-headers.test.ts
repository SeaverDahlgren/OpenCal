import { describe, expect, it } from "vitest";
import { applySecurityHeaders } from "../apps/api/src/server/http.js";

describe("security headers", () => {
  it("applies no-store and defensive defaults", () => {
    const headers = new Map<string, string>();
    const res = {
      setHeader(name: string, value: string) {
        headers.set(name.toLowerCase(), value);
      },
    } as never;

    applySecurityHeaders(res);

    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("x-frame-options")).toBe("DENY");
    expect(headers.get("referrer-policy")).toBe("no-referrer");
    expect(headers.get("permissions-policy")).toBe("geolocation=(), microphone=(), camera=()");
    expect(headers.get("cache-control")).toBe("no-store");
    expect(headers.has("strict-transport-security")).toBe(false);
  });

  it("adds hsts outside development", () => {
    const headers = new Map<string, string>();
    const res = {
      setHeader(name: string, value: string) {
        headers.set(name.toLowerCase(), value);
      },
    } as never;

    applySecurityHeaders(res, "production");

    expect(headers.get("strict-transport-security")).toBe("max-age=31536000; includeSubDomains");
  });
});
