import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildSelectedSkillDetails,
  buildSkillsCatalog,
  loadSkillManifests,
  parseSkillManifest,
  selectRelevantSkills,
} from "../src/skills/manifests.js";
import { buildSystemPrompt } from "../src/agent/prompts.js";

describe("skill manifests", () => {
  it("parses a markdown skill manifest", () => {
    const manifest = parseSkillManifest(
      `---
id: calendar-query-expansion
summary: Expand calendar requests.
domains:
  - calendar
triggers:
  - "\\\\bmeeting\\\\b"
read_when:
  - testing
examples:
  - Find my meetings
---

Body text here.`,
      "docs/skills/calendar-query-expansion.md",
    );

    expect(manifest?.id).toBe("calendar-query-expansion");
    expect(manifest?.domains).toEqual(["calendar"]);
    expect(manifest?.path).toBe("docs/skills/calendar-query-expansion.md");
    expect(manifest?.body).toContain("Body text here.");
  });

  it("loads skill manifests from docs/skills", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencal-skills-"));
    await fs.mkdir(path.join(rootDir, "docs", "skills"), { recursive: true });
    await fs.writeFile(
      path.join(rootDir, "docs", "skills", "test-skill.md"),
      `---
id: test-skill
summary: Test skill
domains: [calendar]
triggers: ["meeting"]
read_when: ["tests"]
examples: ["Find my meetings"]
---

Skill body.`,
      "utf8",
    );

    const manifests = await loadSkillManifests(rootDir);
    expect(manifests).toHaveLength(1);
    expect(manifests[0]?.id).toBe("test-skill");
  });

  it("selects relevant skills for semantic calendar and time phrases", () => {
    const selected = selectRelevantSkills(
      [
        {
          id: "calendar-query-expansion",
          summary: "calendar",
          domains: ["calendar"],
          triggers: ["\\bhow many times\\b", "\\bpractice\\b"],
          readWhen: [],
          examples: [],
          path: "docs/skills/calendar-query-expansion.md",
          body: "calendar body",
        },
        {
          id: "ambiguous-time-handling",
          summary: "time",
          domains: ["time"],
          triggers: ["\\bnext month\\b"],
          readWhen: [],
          examples: [],
          path: "docs/skills/ambiguous-time-handling.md",
          body: "time body",
        },
      ],
      "How many times am I swimming next month?",
    );

    expect(selected.map((skill) => skill.id)).toEqual([
      "ambiguous-time-handling",
      "calendar-query-expansion",
    ]);
  });

  it("builds a catalog and injects selected skill details into the prompt", () => {
    const catalog = buildSkillsCatalog([
      {
        id: "calendar-query-expansion",
        summary: "Expand calendar requests.",
        domains: ["calendar"],
        triggers: [],
        readWhen: [],
        examples: [],
        path: "docs/skills/calendar-query-expansion.md",
        body: "calendar body",
      },
    ]);

    const prompt = buildSystemPrompt({
      soul: "soul",
      user: "user",
      tools: [],
      skillsCatalog: catalog,
      selectedSkillDetails: buildSelectedSkillDetails([
        {
          id: "calendar-query-expansion",
          path: "docs/skills/calendar-query-expansion.md",
          reason: "trigger:meeting",
          body: "calendar body",
        },
      ]),
      memory: "memory",
      runtime: {
        nowIso: "2026-03-25T00:00:00.000Z",
        dayOfWeek: "Wednesday",
        timezone: "America/Los_Angeles",
      },
      tokenUsage: {
        estimatedInputTokens: 10,
        contextWindowLimit: 100,
        maxOutputTokens: 20,
        compactionThreshold: 0.8,
      },
    });

    expect(prompt).toContain("Available semantic skills:");
    expect(prompt).toContain("details: docs/skills/calendar-query-expansion.md");
    expect(prompt).toContain("skill_id: calendar-query-expansion");
    expect(prompt).toContain("calendar body");
  });
});
