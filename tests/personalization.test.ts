import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildMemoryPersonalizationBlock,
  maybeRunPersonalizationSetup,
  updateUserMarkdown,
} from "../src/setup/personalization.js";

class FakeIO {
  constructor(
    private readonly answers: string[],
    private readonly shouldRun = true,
  ) {}

  print() {}

  async ask() {
    return this.answers.shift() ?? "";
  }

  async confirm() {
    return this.shouldRun;
  }
}

describe("updateUserMarkdown", () => {
  it("updates working hours and appends meeting preferences", () => {
    const next = updateUserMarkdown(
      "# USER\n- timezone: America/Los_Angeles\n- working_hours: 09:00-17:00\n",
      {
        workingHours: "08:30-16:30",
        meetingPreferences: "Prefer afternoons Tuesday through Thursday.",
      },
    );

    expect(next).toContain("- working_hours: 08:30-16:30");
    expect(next).toContain("- meeting_preferences: Prefer afternoons Tuesday through Thursday.");
  });
});

describe("buildMemoryPersonalizationBlock", () => {
  it("creates a durable memory block for setup answers", () => {
    const block = buildMemoryPersonalizationBlock({
      interests: "AI agents and trail running",
      additionalContext: "Keep mornings focused when possible.",
    });

    expect(block).toContain("Setup personalization");
    expect(block).toContain("current_interests: AI agents and trail running");
    expect(block).toContain("additional_context: Keep mornings focused when possible.");
  });
});

describe("maybeRunPersonalizationSetup", () => {
  it("writes answers once and records setup state", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencal-setup-"));
    await fs.mkdir(path.join(rootDir, ".opencal"), { recursive: true });
    await fs.writeFile(
      path.join(rootDir, "USER.md"),
      "# USER\n- timezone: America/Los_Angeles\n- working_hours: 09:00-17:00\n",
      "utf8",
    );
    await fs.writeFile(path.join(rootDir, "Memory.md"), "# Memory\n", "utf8");

    const io = new FakeIO([
      "AI agents and running",
      "08:00-16:00",
      "Late morning if possible",
      "Prefer concise summaries",
    ]);

    await maybeRunPersonalizationSetup(rootDir, io);

    const user = await fs.readFile(path.join(rootDir, "USER.md"), "utf8");
    const memory = await fs.readFile(path.join(rootDir, "Memory.md"), "utf8");
    const state = JSON.parse(
      await fs.readFile(path.join(rootDir, ".opencal", "setup-state.json"), "utf8"),
    );

    expect(user).toContain("- working_hours: 08:00-16:00");
    expect(user).toContain("- meeting_preferences: Late morning if possible");
    expect(memory).toContain("current_interests: AI agents and running");
    expect(memory).toContain("additional_context: Prefer concise summaries");
    expect(state.personalizationCompletedAt).toBeTruthy();
  });
});
