import type { UserProfile } from "../users/profile.js";

export type TodayRecommendationInsight = {
  title: string;
  body: string;
  actionLabel: string;
  action: {
    type: "chat_prompt";
    prompt: string;
  };
};

export type TodayRecommendationRecord = TodayRecommendationInsight & {
  email: string;
  date: string;
  timezone: string;
  generatedAt: string;
};

export type TodayRecommendationInput = {
  user: {
    name: string;
    email: string;
  };
  profile: UserProfile;
  date: string;
  timezone: string;
  schedule: Array<{
    eventId: string;
    title: string;
    timeLabel: string;
    attendeePreview: string[];
  }>;
};

export interface TodayRecommendationRepository {
  load(email: string, date: string): Promise<TodayRecommendationRecord | null>;
  save(record: TodayRecommendationRecord): Promise<void>;
}

export type TodayRecommendationGenerator = (
  input: TodayRecommendationInput,
) => Promise<TodayRecommendationInsight>;
