import { describe, expect, it } from "vitest";
import { buildToolRegistry } from "../src/tools/registry.js";

const ioStub = {
  print() {},
  close() {},
  ask: async () => "",
  confirm: async () => true,
  choose: async () => undefined,
};

describe("calendar tool calendarId normalization", () => {
  it("defaults null and empty calendarId values to primary", () => {
    const tools = buildToolRegistry(
      {
        calendar: {} as any,
        gmail: {} as any,
      },
      ioStub as any,
    );

    const getEventTool = tools.get("get_event");
    if (!getEventTool) {
      throw new Error("get_event tool missing");
    }

    expect(getEventTool.inputSchema.parse({ calendarId: null, eventId: "evt-1" })).toEqual({
      calendarId: "primary",
      eventId: "evt-1",
    });

    expect(getEventTool.inputSchema.parse({ calendarId: "", eventId: "evt-1" })).toEqual({
      calendarId: "primary",
      eventId: "evt-1",
    });
  });
});
