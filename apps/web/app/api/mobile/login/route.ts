import { NextRequest, NextResponse } from "next/server";
import { db } from "@barnsquire/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signAccessToken, signRefreshToken } from "@/lib/mobile-auth";

// Mobile login: exchange email/password for an access + refresh token pair.
// Mirrors the credential check in lib/auth.ts `authorize()`, but returns tokens
// (bearer) instead of setting a session cookie.

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  // Same generic response whether the email is unknown or the password is wrong.
  if (!user?.passwordHash) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const claims = {
    sub: user.id,
    email: user.email,
    name: user.name,
    tokenVersion: user.tokenVersion,
  };
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(claims),
    signRefreshToken(claims),
  ]);

  return NextResponse.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      mustChangePassword: user.mustChangePassword,
      locale: user.locale ?? null,
    },
  });
}
