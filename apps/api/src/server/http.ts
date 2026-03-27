import http from "node:http";

export class RequestTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super(`Request body exceeded ${maxBytes} bytes.`);
    this.name = "RequestTooLargeError";
  }
}

export function applySecurityHeaders(res: http.ServerResponse) {
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("x-frame-options", "DENY");
  res.setHeader("referrer-policy", "no-referrer");
  res.setHeader("permissions-policy", "geolocation=(), microphone=(), camera=()");
  res.setHeader("cache-control", "no-store");
}

export async function readJsonBody<T extends Record<string, unknown>>(req: http.IncomingMessage, maxBytes = 1024 * 1024) {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > maxBytes) {
      throw new RequestTooLargeError(maxBytes);
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) {
    return {} as T;
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

export async function jsonRoute(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

export async function jsonError(
  res: http.ServerResponse,
  status: number,
  code: string,
  message: string,
  retryable: boolean,
  options?: {
    retryAfterSeconds?: number;
  },
) {
  const requestId = res.getHeader("x-request-id");
  return await jsonRoute(res, status, {
    error: {
      code,
      message,
      retryable,
      retryAfterSeconds: options?.retryAfterSeconds,
      requestId: typeof requestId === "string" ? requestId : undefined,
    },
  });
}

export function readBearerToken(req: http.IncomingMessage) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  return header.slice("Bearer ".length);
}

export function readAdminKey(req: http.IncomingMessage) {
  const value = req.headers["x-admin-key"];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function readIdempotencyKey(req: http.IncomingMessage) {
  const value = req.headers["idempotency-key"];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
