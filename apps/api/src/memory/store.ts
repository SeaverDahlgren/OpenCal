import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../../../../src/config/env.js";
import { readSecureJsonFile, writeSecureJsonFile } from "../storage/secure-json.js";
import type { MemoryRepository } from "../storage/types.js";
import type { ProductionMemoryRecord } from "./types.js";

const MEMORY_FILE = "production-memory.json";

type ProductionMemoryState = {
  records: Record<string, ProductionMemoryRecord>;
};

export class ProductionMemoryStore implements MemoryRepository {
  constructor(private readonly config: AppConfig) {}

  async listByEmail(email: string) {
    const state = await this.readState();
    return Object.values(state.records)
      .filter((record) => record.email === normalizeEmail(email))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async loadBySource(email: string, source: string) {
    const state = await this.readState();
    return (
      Object.values(state.records).find(
        (record) => record.email === normalizeEmail(email) && record.source === source,
      ) ?? null
    );
  }

  async save(record: ProductionMemoryRecord) {
    const state = await this.readState();
    state.records[record.memoryId] = {
      ...record,
      email: normalizeEmail(record.email),
    };
    await this.writeState(state);
  }

  async nextId() {
    return `mem_${crypto.randomUUID()}`;
  }

  private async readState(): Promise<ProductionMemoryState> {
    await fs.mkdir(this.config.privateDir, { recursive: true });
    return (
      (await readSecureJsonFile<ProductionMemoryState>(this.filePath(), this.config.stateEncryptionKey)) ?? {
        records: {},
      }
    );
  }

  private async writeState(state: ProductionMemoryState) {
    await writeSecureJsonFile(this.filePath(), state, this.config.stateEncryptionKey);
  }

  private filePath() {
    return path.join(this.config.privateDir, MEMORY_FILE);
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
