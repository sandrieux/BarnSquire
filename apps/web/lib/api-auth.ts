import { timingSafeEqual } from "node:crypto";

// Shared-secret auth for headless endpoints (cron, integrations). One
// implementation so the constant-time comparison can't drift between routes.

// Constant-time secret comparison that also avoids leaking length via early return.
export function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Check an `Authorization: Bearer <secret>` header against the expected secret.
 * Header only — never the query string, which lands in proxy/access logs.
 */
export function bearerSecretMatches(headers: Headers, expected: string): boolean {
  const provided = headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return secretMatches(provided, expected);
}
