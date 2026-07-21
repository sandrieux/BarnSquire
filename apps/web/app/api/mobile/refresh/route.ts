import { NextRequest, NextResponse } from "next/server";
import { db } from "@barnsquire/db";
import { z } from "zod";
import { signAccessToken, verifyMobileToken } from "@/lib/mobile-auth";

// Mobile refresh: exchange a valid refresh token for a fresh access token.
// The refresh token itself is not rotated here (kept simple for v1); it expires
// after 60 days, at which point the user logs in again.

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = refreshSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing refresh token" }, { status: 400 });
  }

  const claims = await verifyMobileToken(parsed.data.refreshToken, "refresh");
  if (!claims?.sub) {
    return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
  }

  // Ensure the account still exists (e.g. not deleted since the token was issued).
  const user = await db.user.findUnique({ where: { id: claims.sub } });
  if (!user) {
    return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
  }

  const accessToken = await signAccessToken({
    sub: user.id,
    email: user.email,
    name: user.name,
  });
  return NextResponse.json({ accessToken });
}
