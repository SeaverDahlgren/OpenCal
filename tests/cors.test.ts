import { describe, expect, it } from "vitest";
import { isAllowedOrigin } from "../apps/api/src/server/cors.js";

describe("cors origin allowlist", () => {
  it("allows configured hosted origins outside development", () => {
    expect(
      isAllowedOrigin("https://opencal-demo.vercel.app", {
        appEnv: "staging",
        allowedWebOrigins: ["https://opencal-demo.vercel.app"],
      }),
    ).toBe(true);
  });

  it("allows common localhost web origins in development", () => {
    expect(
      isAllowedOrigin("http://localhost:5173", {
        appEnv: "development",
        allowedWebOrigins: [],
      }),
    ).toBe(true);
  });

  it("rejects unknown origins in staging", () => {
    expect(
      isAllowedOrigin("https://malicious.example.com", {
        appEnv: "staging",
        allowedWebOrigins: ["https://opencal-demo.vercel.app"],
      }),
    ).toBe(false);
  });
});
