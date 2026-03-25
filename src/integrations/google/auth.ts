import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { URL } from "node:url";
import { google } from "googleapis";
import type { calendar_v3, gmail_v1 } from "googleapis";
import type { Credentials } from "google-auth-library";
import type { AppConfig } from "../../config/env.js";
import type { ConsoleIO } from "../../cli/io.js";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
];

const SERVICE_NAME = "openCal";
const TOKEN_ACCOUNT = "google-oauth-token";
const ENCRYPTED_TOKEN_PATH = "google-token.enc";

export type GoogleClients = {
  calendar: calendar_v3.Calendar;
  gmail: gmail_v1.Gmail;
};

export async function ensureGoogleAuthorization(
  config: AppConfig,
  io: ConsoleIO,
  forceRefresh = false,
): Promise<InstanceType<typeof google.auth.OAuth2>> {
  await fs.mkdir(config.privateDir, { recursive: true });

  const client = new google.auth.OAuth2(
    config.googleClientId,
    config.googleClientSecret,
    config.googleRedirectUri,
  );

  if (!forceRefresh) {
    const stored = await readStoredToken(config);
    if (stored) {
      client.setCredentials(stored);
      return client;
    }
  }

  io.print("Google scopes requested:");
  SCOPES.forEach((scope) => io.print(`- ${scope}`));

  const confirmed = await io.confirm("Authorize Gmail and Google Calendar access?");
  if (!confirmed) {
    throw new Error("Google authorization declined.");
  }

  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });

  io.print("Open this URL in your browser to authorize:");
  io.print(authUrl);

  const code = await waitForOAuthCode(config.googleRedirectUri, io);
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  await storeToken(config, tokens);

  return client;
}

export function createGoogleClients(auth: InstanceType<typeof google.auth.OAuth2>): GoogleClients {
  return {
    calendar: google.calendar({ version: "v3", auth }),
    gmail: google.gmail({ version: "v1", auth }),
  };
}

async function waitForOAuthCode(redirectUri: string, io: ConsoleIO): Promise<string> {
  const parsedUrl = new URL(redirectUri);
  const port = Number(parsedUrl.port || "80");
  const pathname = parsedUrl.pathname;

  return new Promise<string>((resolve, reject) => {
    const server = http.createServer((request, response) => {
      if (!request.url) {
        response.statusCode = 400;
        response.end("Missing request URL.");
        return;
      }

      const requestUrl = new URL(request.url, redirectUri);
      if (requestUrl.pathname !== pathname) {
        response.statusCode = 404;
        response.end("Not found.");
        return;
      }

      const code = requestUrl.searchParams.get("code");
      const error = requestUrl.searchParams.get("error");

      if (error) {
        response.statusCode = 400;
        response.end(`OAuth error: ${error}`);
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (!code) {
        response.statusCode = 400;
        response.end("Missing OAuth code.");
        return;
      }

      response.statusCode = 200;
      response.end("Authorization received. Return to the CLI.");
      server.close();
      resolve(code);
    });

    server.listen(port, parsedUrl.hostname, () => {
      io.print(`Waiting for OAuth callback on ${redirectUri}`);
    });

    server.on("error", reject);
  });
}

async function storeToken(config: AppConfig, token: Credentials) {
  const serialized = JSON.stringify(token);

  if (await tryWriteKeytar(TOKEN_ACCOUNT, serialized)) {
    return;
  }

  const encrypted = encryptToken(serialized, config.googleClientSecret);
  await fs.writeFile(path.join(config.privateDir, ENCRYPTED_TOKEN_PATH), encrypted, "utf8");
}

async function readStoredToken(config: AppConfig): Promise<Credentials | null> {
  const fromKeytar = await tryReadKeytar(TOKEN_ACCOUNT);
  if (fromKeytar) {
    return JSON.parse(fromKeytar) as Credentials;
  }

  const tokenPath = path.join(config.privateDir, ENCRYPTED_TOKEN_PATH);
  try {
    const encrypted = await fs.readFile(tokenPath, "utf8");
    return JSON.parse(decryptToken(encrypted, config.googleClientSecret)) as Credentials;
  } catch {
    return null;
  }
}

function encryptToken(payload: string, secret: string): string {
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(`${secret}:${os.hostname()}`, "openCal", 32);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

function decryptToken(payload: string, secret: string): string {
  const data = Buffer.from(payload, "base64");
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const ciphertext = data.subarray(28);
  const key = crypto.scryptSync(`${secret}:${os.hostname()}`, "openCal", 32);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

async function tryWriteKeytar(account: string, value: string): Promise<boolean> {
  try {
    const keytar = await import("keytar");
    await keytar.setPassword(SERVICE_NAME, account, value);
    return true;
  } catch {
    return false;
  }
}

async function tryReadKeytar(account: string): Promise<string | null> {
  try {
    const keytar = await import("keytar");
    return await keytar.getPassword(SERVICE_NAME, account);
  } catch {
    return null;
  }
}
