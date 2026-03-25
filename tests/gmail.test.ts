import { describe, expect, it } from "vitest";
import { decodeMimeMessage, GoogleGmailService } from "../src/integrations/google/gmail.js";

describe("GoogleGmailService.writeDraft", () => {
  it("keeps the required blank line between headers and body", async () => {
    let capturedRaw = "";

    const service = new GoogleGmailService({
      users: {
        drafts: {
          create: async ({ requestBody }: any) => {
            capturedRaw = requestBody.message.raw;
            return {
              data: {
                id: "draft-1",
                message: { id: "msg-1" },
              },
            };
          },
        },
      },
    } as any);

    await service.writeDraft({
      to: ["test@example.com"],
      subject: "Move meeting",
      body: "Can we move this to tomorrow?",
    });

    expect(decodeMimeMessage(capturedRaw)).toContain(
      "Content-Transfer-Encoding: 7bit\r\n\r\nCan we move this to tomorrow?",
    );
  });
});
