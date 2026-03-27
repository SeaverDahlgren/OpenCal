import { describe, expect, it } from "vitest";
import { readJsonBody, RequestTooLargeError } from "../apps/api/src/server/http.js";

describe("json body reader", () => {
  it("parses small JSON payloads", async () => {
    await expect(
      readJsonBody(
        createRequest([
          Buffer.from(JSON.stringify({ hello: "world" })),
        ]),
        64,
      ),
    ).resolves.toEqual({ hello: "world" });
  });

  it("rejects oversized payloads", async () => {
    await expect(
      readJsonBody(
        createRequest([
          Buffer.from(JSON.stringify({ body: "x".repeat(128) })),
        ]),
        32,
      ),
    ).rejects.toBeInstanceOf(RequestTooLargeError);
  });
});

function createRequest(chunks: Buffer[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  } as never;
}
