import { SignJWT, jwtVerify, type JWTPayload } from "jose";

// Token-based auth for the mobile app. The web uses NextAuth's HTTP-only cookie,
// which a native app can't carry; instead the mobile client exchanges credentials
// for a short-lived access token + a long-lived refresh token here, both signed
// with NEXTAUTH_SECRET (HS256). The tRPC HTTP handler verifies the access token
// from an `Authorization: Bearer` header as an alternative to the cookie session.

const ISSUER = "barnsquire-mobile";
const ACCESS_TTL = "1h";
const REFRESH_TTL = "60d";

export type TokenType = "access" | "refresh";

export interface MobileUserClaims {
  sub: string; // user id
  email?: string | null;
  name?: string | null;
}

export interface MobileTokenPayload extends JWTPayload {
  email?: string | null;
  name?: string | null;
  type: TokenType;
}

function getSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required to sign/verify mobile tokens");
  }
  return new TextEncoder().encode(secret);
}

async function sign(claims: MobileUserClaims, type: TokenType, ttl: string): Promise<string> {
  return new SignJWT({ email: claims.email ?? null, name: claims.name ?? null, type })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(getSecret());
}

export function signAccessToken(claims: MobileUserClaims): Promise<string> {
  return sign(claims, "access", ACCESS_TTL);
}

export function signRefreshToken(claims: MobileUserClaims): Promise<string> {
  return sign(claims, "refresh", REFRESH_TTL);
}

// Returns the verified payload, or null if the token is invalid, expired, or of
// the wrong type. Never throws.
export async function verifyMobileToken(
  token: string,
  expectedType: TokenType,
): Promise<MobileTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { issuer: ISSUER });
    if (payload["type"] !== expectedType || typeof payload.sub !== "string") {
      return null;
    }
    return payload as MobileTokenPayload;
  } catch {
    return null;
  }
}
