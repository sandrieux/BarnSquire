import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createContext } from "@barnsquire/trpc";
import type { AuthSession } from "@barnsquire/trpc";
import { auth } from "@/lib/auth";
import { verifyMobileToken } from "@/lib/mobile-auth";
import type { NextRequest } from "next/server";

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => {
      // Mobile clients authenticate with a bearer access token; browsers use the
      // NextAuth cookie. Try the bearer token first, then fall back to the cookie.
      let session: AuthSession | null = null;

      const authorization = req.headers.get("authorization");
      if (authorization?.startsWith("Bearer ")) {
        const claims = await verifyMobileToken(authorization.slice("Bearer ".length), "access");
        if (claims?.sub) {
          session = { user: { id: claims.sub, name: claims.name, email: claims.email } };
        }
      } else {
        const nextSession = await auth();
        session = nextSession
          ? { user: { id: nextSession.user?.id, name: nextSession.user?.name, email: nextSession.user?.email } }
          : null;
      }

      return createContext({ session });
    },
    onError({ error }) {
      if (error.code === "INTERNAL_SERVER_ERROR") {
        console.error("tRPC error:", error);
      }
    },
  });

export { handler as GET, handler as POST };
