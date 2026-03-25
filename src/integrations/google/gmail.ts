import type { gmail_v1 } from "googleapis";

export class GoogleGmailService {
  constructor(private readonly client: gmail_v1.Gmail) {}

  async searchEmails(args: { query: string; maxResults: number }) {
    const listResponse = await this.client.users.messages.list({
      userId: "me",
      q: args.query,
      maxResults: args.maxResults,
    });

    const messages = listResponse.data.messages ?? [];
    const hydrated = await Promise.all(
      messages.map(async (message) => {
        const detail = await this.client.users.messages.get({
          userId: "me",
          id: message.id ?? "",
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        });
        return this.mapMessageSummary(detail.data);
      }),
    );

    return hydrated;
  }

  async listThreads(maxResults: number) {
    const response = await this.client.users.threads.list({
      userId: "me",
      maxResults,
    });

    const threads = response.data.threads ?? [];
    const hydrated = await Promise.all(
      threads.map(async (thread) => {
        const detail = await this.client.users.threads.get({
          userId: "me",
          id: thread.id ?? "",
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        });
        return this.mapThreadSummary(detail.data);
      }),
    );

    return hydrated;
  }

  async getThreadDetails(threadId: string, maxMessages = 5) {
    const response = await this.client.users.threads.get({
      userId: "me",
      id: threadId,
      format: "full",
    });

    const messages = response.data.messages ?? [];
    return messages.slice(-maxMessages).map((message) => ({
      id: message.id ?? "",
      snippet: message.snippet ?? "",
      headers: headerMap(message.payload?.headers ?? []),
    }));
  }

  async writeDraft(args: {
    to: string[];
    subject: string;
    body: string;
    cc?: string[];
    bcc?: string[];
  }) {
    const raw = createMimeMessage(args);
    const response = await this.client.users.drafts.create({
      userId: "me",
      requestBody: {
        message: {
          raw,
        },
      },
    });

    return {
      id: response.data.id ?? "",
      messageId: response.data.message?.id ?? "",
      to: args.to,
      subject: args.subject,
    };
  }

  private mapMessageSummary(message: gmail_v1.Schema$Message) {
    const headers = headerMap(message.payload?.headers ?? []);
    return {
      id: message.id ?? "",
      threadId: message.threadId ?? "",
      from: headers.From ?? "",
      subject: headers.Subject ?? "",
      date: headers.Date ?? "",
      snippet: message.snippet ?? "",
    };
  }

  private mapThreadSummary(thread: gmail_v1.Schema$Thread) {
    const latest = thread.messages?.at(-1);
    const headers = headerMap(latest?.payload?.headers ?? []);
    return {
      id: thread.id ?? "",
      subject: headers.Subject ?? "",
      from: headers.From ?? "",
      date: headers.Date ?? "",
      snippet: latest?.snippet ?? "",
      messageCount: thread.messages?.length ?? 0,
    };
  }
}

function headerMap(headers: gmail_v1.Schema$MessagePartHeader[]) {
  return Object.fromEntries(headers.map((header) => [header.name ?? "", header.value ?? ""]));
}

function createMimeMessage(args: {
  to: string[];
  subject: string;
  body: string;
  cc?: string[];
  bcc?: string[];
}) {
  const lines = [
    `To: ${args.to.join(", ")}`,
    args.cc?.length ? `Cc: ${args.cc.join(", ")}` : null,
    args.bcc?.length ? `Bcc: ${args.bcc.join(", ")}` : null,
    `Subject: ${args.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    args.body,
  ].filter((line): line is string => line !== null);

  return Buffer.from(lines.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function decodeMimeMessage(raw: string) {
  const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}
