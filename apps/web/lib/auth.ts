import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@barnsquire/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Required for self-hosted deployments (non-Vercel): trust the host header
  // so Auth.js accepts requests served from a custom domain behind a proxy.
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        // Throttle brute-force / credential stuffing per source IP. Keyed by IP
        // (not email) to avoid a targeted account-lockout DoS.
        const ip = clientIp(new Headers(request?.headers as HeadersInit));
        if (!rateLimit(`web-login:${ip}`, 20, 10 * 60 * 1000).ok) {
          throw new Error("RATE_LIMITED");
        }

        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          mustChangePassword: user.mustChangePassword,
          locale: user.locale ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token["id"] = user.id;
        token["mustChangePassword"] = user.mustChangePassword;
        token["locale"] = user.locale;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token["id"] as string;
        session.user.mustChangePassword = Boolean(token["mustChangePassword"]);
        session.user.locale = (token["locale"] as string | undefined) ?? undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
});
