type ParsedLlmError = {
  code?: number | string;
  status?: string;
  message?: string;
};

const RETRYABLE_CODES = new Set([408, 429, 500, 502, 503, 504]);
const RETRYABLE_STATUSES = new Set([
  "ABORTED",
  "DEADLINE_EXCEEDED",
  "INTERNAL",
  "RATE_LIMIT_EXCEEDED",
  "RESOURCE_EXHAUSTED",
  "TOO_MANY_REQUESTS",
  "TOOMANYREQUESTS",
  "UNAVAILABLE",
]);

export function toUserFacingLlmErrorMessage(error: unknown): string {
  const parsed = parseLlmError(error);
  const normalizedCode =
    typeof parsed.code === "string" ? normalizeErrorToken(parsed.code) : parsed.code;
  const normalizedStatus = parsed.status ? normalizeErrorToken(parsed.status) : undefined;

  if (
    (typeof normalizedCode === "number" && RETRYABLE_CODES.has(normalizedCode)) ||
    (typeof normalizedCode === "string" && RETRYABLE_STATUSES.has(normalizedCode)) ||
    (normalizedStatus && RETRYABLE_STATUSES.has(normalizedStatus))
  ) {
    return "The model is temporarily unavailable right now. Please try again in a minute.";
  }

  return "The model request failed, so I couldn't finish that turn. Check your API credentials/config and try again.";
}

function parseLlmError(error: unknown): ParsedLlmError {
  const fromObject = extractObjectShape(error);
  if (fromObject) {
    return fromObject;
  }

  if (error instanceof Error) {
    const fromMessage = tryParseJson(error.message);
    if (fromMessage) {
      return fromMessage;
    }

    return {
      message: error.message,
    };
  }

  if (typeof error === "string") {
    return tryParseJson(error) ?? { message: error };
  }

  return {};
}

function extractObjectShape(error: unknown): ParsedLlmError | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const record = error as Record<string, unknown>;
  if (record.error && typeof record.error === "object") {
    const nested = record.error as Record<string, unknown>;
    return {
      code: asCode(nested.code),
      status: asString(nested.status),
      message: asString(nested.message),
    };
  }

  return {
    code: asCode(record.code),
    status: asString(record.status),
    message: asString(record.message),
  };
}

function tryParseJson(value: string): ParsedLlmError | null {
  try {
    return extractObjectShape(JSON.parse(value));
  } catch {
    return null;
  }
}

function asCode(value: unknown): number | string | undefined {
  if (typeof value === "number" || typeof value === "string") {
    return value;
  }
  return undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function normalizeErrorToken(value: string): string {
  return value.trim().replace(/[\s-]+/g, "_").toUpperCase();
}
