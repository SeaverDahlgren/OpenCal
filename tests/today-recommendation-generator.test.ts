import { describe, expect, it } from "vitest";
import {
  buildTodayRecommendationPrompt,
  parseTodayRecommendationPayload,
} from "../apps/api/src/recommendations/generator.js";
import type { UserProfile } from "../apps/api/src/users/profile.js";

describe("today recommendation generator", () => {
  it("builds a compact prompt from the schedule and profile context", () => {
    const profile: UserProfile = {
      email: "avery@example.com",
      name: "Avery",
      timezone: "America/Los_Angeles",
      workStart: "09:00",
      workEnd: "17:00",
      meetingPreference: "Avoid back-to-back meetings.",
      interests: "Running and AI agents",
      additionalContext: "Keep advice tactical.",
      assistantNotes: "Protect the first hour for deep work.",
      updatedAt: "2026-03-30T20:00:00.000Z",
    };

    const prompt = buildTodayRecommendationPrompt({
      user: {
        name: "Avery",
        email: "avery@example.com",
      },
      profile,
      memoryContext: "Remembers that Avery protects workout time and prefers concise planning.",
      date: "2026-03-31",
      timezone: profile.timezone,
      schedule: [
        {
          eventId: "evt-1",
          title: "Job discussion with Sally",
          timeLabel: "5:00 PM - 5:30 PM",
          attendeePreview: ["sally@example.com"],
        },
      ],
    });

    expect(prompt).toContain("2026-03-31");
    expect(prompt).toContain("Priority order for today's recommendation:");
    expect(prompt).toContain("Today's calendar (highest priority):");
    expect(prompt).toContain("Avoid back-to-back meetings.");
    expect(prompt).toContain("Running and AI agents");
    expect(prompt).toContain("Keep advice tactical.");
    expect(prompt).toContain("Protect the first hour for deep work.");
    expect(prompt).toContain("protects workout time");
    expect(prompt).toContain("Interests (lower priority):");
    expect(prompt).toContain("5:00 PM - 5:30 PM");
    expect(prompt).toContain("Job discussion with Sally");
  });

  it("parses the model payload into a Today insight shape", () => {
    const parsed = parseTodayRecommendationPayload(
      JSON.stringify({
        title: "Protect your focus window",
        body: "Use the morning for deep work before your afternoon conversation.",
        actionLabel: "Plan this with AI",
        actionPrompt: "Help me execute today’s plan.",
      }),
    );

    expect(parsed).toEqual({
      title: "Protect your focus window",
      body: "Use the morning for deep work before your afternoon conversation.",
      actionLabel: "Plan this with AI",
      action: {
        type: "chat_prompt",
        prompt: "Help me execute today’s plan.",
      },
    });
  });
});
