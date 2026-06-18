import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createContext } from "@barnsquire/trpc";
import type { AuthSession } from "@barnsquire/trpc";
import { auth } from "@/lib/auth";
import type { NextRequest } from "next/server";

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => {
      const nextSession = await auth();
      const session: AuthSession | null = nextSession
        ? { user: { id: nextSession.user?.id, name: nextSession.user?.name, email: nextSession.user?.email } }
        : null;
      return createContext({ session });
    },
    onError({ error }) {
      if (error.code === "INTERNAL_SERVER_ERROR") {
        console.error("tRPC error:", error);
      }
    },
  });

export { handler as GET, handler as POST };
