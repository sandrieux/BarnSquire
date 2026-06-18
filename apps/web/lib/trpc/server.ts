import { appRouter, createContext, createCallerFactory } from "@barnsquire/trpc";
import type { AuthSession } from "@barnsquire/trpc";
import { auth } from "@/lib/auth";

const createCaller = createCallerFactory(appRouter);

export async function createServerCaller() {
  const nextSession = await auth();
  const session: AuthSession | null = nextSession
    ? { user: { id: nextSession.user?.id, name: nextSession.user?.name, email: nextSession.user?.email } }
    : null;
  const ctx = await createContext({ session });
  return createCaller(ctx);
}
