import { describe, expect, it } from "vitest";
import { getGoogleScopes } from "../src/integrations/google/auth.js";

describe("google auth scopes", () => {
  it("includes identity scopes needed for backend session bootstrap", () => {
    expect(getGoogleScopes()).toEqual(
      expect.arrayContaining(["openid", "email", "profile"]),
    );
  });
});
