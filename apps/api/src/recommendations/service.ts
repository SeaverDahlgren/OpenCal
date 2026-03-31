import type {
  TodayRecommendationGenerator,
  TodayRecommendationInput,
  TodayRecommendationInsight,
  TodayRecommendationRepository,
} from "./types.js";

export class TodayRecommendationService {
  constructor(
    private readonly recommendations: TodayRecommendationRepository,
    private readonly generate: TodayRecommendationGenerator,
    private readonly onError?: (error: unknown) => void,
  ) {}

  async getOrCreate(input: TodayRecommendationInput): Promise<TodayRecommendationInsight | null> {
    const cached = await this.recommendations.load(input.user.email, input.date);
    if (cached) {
      return toInsight(cached);
    }

    try {
      const next = await this.generate(input);
      const record = {
        ...next,
        email: input.user.email,
        date: input.date,
        timezone: input.timezone,
        generatedAt: new Date().toISOString(),
      };
      await this.recommendations.save(record);
      return toInsight(record);
    } catch (error) {
      this.onError?.(error);
      return null;
    }
  }
}

function toInsight(record: TodayRecommendationInsight) {
  return {
    title: record.title,
    body: record.body,
    actionLabel: record.actionLabel,
    action: {
      type: "chat_prompt" as const,
      prompt: record.action.prompt,
    },
  };
}
