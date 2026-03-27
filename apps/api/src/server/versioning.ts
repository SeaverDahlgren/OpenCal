import type { IncomingMessage } from "node:http";

export function readClientAppVersion(req: IncomingMessage) {
  const value = req.headers["x-opencal-app-version"];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function isSupportedAppVersion(clientVersion: string | null, minimumVersion?: string) {
  if (!minimumVersion) {
    return true;
  }
  if (!clientVersion) {
    return false;
  }
  return compareSemver(clientVersion, minimumVersion) >= 0;
}

export function compareSemver(left: string, right: string) {
  const leftParts = normalize(left);
  const rightParts = normalize(right);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (delta !== 0) {
      return delta;
    }
  }
  return 0;
}

function normalize(value: string) {
  return value
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));
}
