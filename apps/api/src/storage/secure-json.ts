import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

type EncryptedFilePayload = {
  version: 1;
  algorithm: "aes-256-gcm";
  iv: string;
  tag: string;
  ciphertext: string;
};

export async function readSecureJsonFile<T>(filePath: string, encryptionKey?: string) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as T | EncryptedFilePayload;
    if (!isEncryptedFilePayload(parsed)) {
      return parsed as T;
    }

    if (!encryptionKey) {
      throw new Error(`Encrypted state file requires STATE_ENCRYPTION_KEY: ${path.basename(filePath)}`);
    }

    return JSON.parse(decryptPayload(parsed, encryptionKey)) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function writeSecureJsonFile(filePath: string, value: unknown, encryptionKey?: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const json = JSON.stringify(value, null, 2);
  if (!encryptionKey) {
    await fs.writeFile(filePath, json, "utf8");
    return;
  }

  await fs.writeFile(filePath, JSON.stringify(encryptPayload(json, encryptionKey), null, 2), "utf8");
}

function encryptPayload(plaintext: string, encryptionKey: string): EncryptedFilePayload {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(encryptionKey), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    version: 1,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function decryptPayload(payload: EncryptedFilePayload, encryptionKey: string) {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    deriveKey(encryptionKey),
    Buffer.from(payload.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

function deriveKey(encryptionKey: string) {
  return crypto.createHash("sha256").update(encryptionKey).digest();
}

function isEncryptedFilePayload(value: unknown): value is EncryptedFilePayload {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<EncryptedFilePayload>;
  return (
    candidate.version === 1 &&
    candidate.algorithm === "aes-256-gcm" &&
    typeof candidate.iv === "string" &&
    typeof candidate.tag === "string" &&
    typeof candidate.ciphertext === "string"
  );
}
