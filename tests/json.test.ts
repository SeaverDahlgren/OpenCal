import { describe, expect, it } from "vitest";
import { extractJsonPayload, parseAgentDecision } from "../src/agent/json.js";

describe("extractJsonPayload", () => {
  it("extracts fenced json", () => {
    const payload = extractJsonPayload('```json\n{"type":"message","message":"ok"}\n```');
    expect(payload).toBe('{"type":"message","message":"ok"}');
  });
});

describe("parseAgentDecision", () => {
  it("parses tool calls", () => {
    const decision = parseAgentDecision(
      '{"type":"tool","reasoning":"need calendar data","toolCalls":[{"name":"list_calendars","arguments":{}}]}',
    );

    expect(decision.type).toBe("tool");
    if (decision.type !== "tool") {
      throw new Error("Expected tool decision");
    }
    expect(decision.toolCalls[0]).toEqual({
      name: "list_calendars",
      arguments: {},
    });
  });
});
