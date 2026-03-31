import fs from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../../../../src/config/env.js";
import { readSecureJsonFile, writeSecureJsonFile } from "../storage/secure-json.js";
import type { TodayRecommendationRecord, TodayRecommendationRepository } from "./types.js";

const RECOMMENDATION_FILE = "today-recommendations.json";

type TodayRecommendationState = {
  recommendations: Record<string, TodayRecommendationRecord>;
};

export class TodayRecommendationStore implements TodayRecommendationRepository {
  constructor(private readonly config: AppConfig) {}

  async load(email: string, date: string) {
    const state = await this.readState();
    return state.recommendations[recommendationKey(email, date)] ?? null;
  }

  async save(record: TodayRecommendationRecord) {
    const state = await this.readState();
    state.recommendations[recommendationKey(record.email, record.date)] = record;
    await this.writeState(state);
  }

  private async readState(): Promise<TodayRecommendationState> {
    await fs.mkdir(this.config.privateDir, { recursive: true });
    return (
      (await readSecureJsonFile<TodayRecommendationState>(this.filePath(), this.config.stateEncryptionKey)) ?? {
        recommendations: {},
      }
    );
  }

  private async writeState(state: TodayRecommendationState) {
    await writeSecureJsonFile(this.filePath(), state, this.config.stateEncryptionKey);
  }

  private filePath() {
    return path.join(this.config.privateDir, RECOMMENDATION_FILE);
  }
}

function recommendationKey(email: string, date: string) {
  return `${email.trim().toLowerCase()}::${date}`;
}
