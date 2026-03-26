import http from "node:http";

export async function readJsonBody<T extends Record<string, unknown>>(req: http.IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
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
) {
  return await jsonRoute(res, status, {
    error: {
      code,
      message,
      retryable,
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
