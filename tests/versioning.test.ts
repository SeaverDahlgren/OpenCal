import http from "node:http";
import { describe, expect, it } from "vitest";
import { compareSemver, isSupportedAppVersion, readClientAppVersion } from "../apps/api/src/server/versioning.js";

describe("api versioning", () => {
  it("compares semver-like app versions", () => {
    expect(compareSemver("1.2.0", "1.1.9")).toBeGreaterThan(0);
    expect(compareSemver("1.0.0", "1.0.0")).toBe(0);
    expect(compareSemver("0.9.9", "1.0.0")).toBeLessThan(0);
  });

  it("requires a client version when a minimum is configured", () => {
    expect(isSupportedAppVersion("1.2.0", "1.1.0")).toBe(true);
    expect(isSupportedAppVersion("1.0.5", "1.1.0")).toBe(false);
    expect(isSupportedAppVersion(null, "1.1.0")).toBe(false);
    expect(isSupportedAppVersion(null, undefined)).toBe(true);
  });

  it("reads the mobile app version header", () => {
    const req = {
      headers: {
        "x-opencal-app-version": "1.0.0",
      },
    } as unknown as http.IncomingMessage;

    expect(readClientAppVersion(req)).toBe("1.0.0");
  });
});
