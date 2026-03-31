import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { AppConfig } from "../../../../src/config/env.js";
import type {
  TodayRecommendationGenerator,
  TodayRecommendationInput,
  TodayRecommendationInsight,
} from "./types.js";

const recommendationSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  actionLabel: z.string().min(1),
  actionPrompt: z.string().min(1),
});

export function createTodayRecommendationGenerator(config: AppConfig): TodayRecommendationGenerator {
  switch (config.llmProvider) {
    case "gemini":
      if (!config.geminiApiKey) {
        throw new Error("GEMINI_API_KEY is required for Today recommendations.");
      }
      return async (input) => {
        const client = new GoogleGenAI({ apiKey: config.geminiApiKey });
        const response = await client.models.generateContent({
          model: config.geminiModel,
          contents: `${buildTodayRecommendationSystemPrompt()}\n\n${buildTodayRecommendationPrompt(input)}`,
          config: {
            temperature: 0.2,
            maxOutputTokens: Math.min(config.maxOutputTokens, 400),
          },
        });
        return parseTodayRecommendationPayload(response.text?.trim() ?? "");
      };
    case "groq":
      if (!config.groqApiKey) {
        throw new Error("GROQ_API_KEY is required for Today recommendations.");
      }
      return async (input) => {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.groqApiKey}`,
          },
          body: JSON.stringify({
            model: config.groqModel,
            messages: [
              {
                role: "system",
                content: buildTodayRecommendationSystemPrompt(),
              },
              {
                role: "user",
                content: buildTodayRecommendationPrompt(input),
              },
            ],
            temperature: 0.2,
            max_completion_tokens: Math.min(config.maxOutputTokens, 400),
            response_format: {
              type: "json_object",
            },
          }),
        });
        const payload = (await response.json()) as {
          choices?: Array<{ message?: { content?: string | null } }>;
          error?: { message?: string };
        };
        if (!response.ok) {
          throw new Error(payload.error?.message ?? "Groq recommendation request failed.");
        }
        return parseTodayRecommendationPayload(payload.choices?.[0]?.message?.content?.trim() ?? "");
      };
    default:
      throw new Error(`Unsupported LLM provider for Today recommendations: ${config.llmProvider}`);
  }
}

export function buildTodayRecommendationSystemPrompt() {
  return [
    "You are OpenCal, an executive planning assistant.",
    "Return strict JSON with keys: title, body, actionLabel, actionPrompt.",
    "Constraints:",
    "- body must be 2 to 4 sentences",
    "- keep guidance practical and specific",
    "- do not invent meetings or deadlines",
    "- actionLabel should be short and clickable",
    "- actionPrompt should ask the assistant to help execute the plan",
  ].join("\n");
}

export function buildTodayRecommendationPrompt(input: TodayRecommendationInput) {
  const scheduleLines = input.schedule.length
    ? input.schedule
        .map((event) =>
          [`- ${event.timeLabel}: ${event.title}`, event.attendeePreview.length ? `  attendees: ${event.attendeePreview.join(", ")}` : null]
            .filter(Boolean)
            .join("\n"),
        )
        .join("\n")
    : "- No events scheduled.";

  return [
    `Date: ${input.date}`,
    `Timezone: ${input.timezone}`,
    `User: ${input.user.name}`,
    `Work hours: ${input.profile.workStart}-${input.profile.workEnd}`,
    `Meeting preference: ${input.profile.meetingPreference || "None provided"}`,
    `Assistant notes: ${input.profile.assistantNotes || "None provided"}`,
    "",
    "Today's schedule:",
    scheduleLines,
  ].join("\n");
}

export function parseTodayRecommendationPayload(payload: string): TodayRecommendationInsight {
  const parsed = recommendationSchema.parse(JSON.parse(payload));
  return {
    title: parsed.title.trim(),
    body: parsed.body.trim(),
    actionLabel: parsed.actionLabel.trim(),
    action: {
      type: "chat_prompt",
      prompt: parsed.actionPrompt.trim(),
    },
  };
}
