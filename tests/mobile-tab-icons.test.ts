import { describe, expect, it } from "vitest";
import { getSettingsTabIcon } from "../apps/mobile/src/navigation/tab-icons.js";

describe("mobile tab icons", () => {
  it("uses a vector gear icon for the settings tab", () => {
    expect(getSettingsTabIcon()).toEqual({
      family: "Feather",
      name: "settings",
    });
  });
});
