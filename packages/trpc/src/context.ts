import { db } from "@barnsquire/db";

export interface AuthSession {
  user?: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
}

export interface AuthenticatedSession {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export interface Context {
  db: typeof db;
  session: AuthSession | null;
  isGlobalAdmin: boolean;
}

export interface AuthenticatedContext extends Context {
  session: AuthenticatedSession;
}

export interface CreateContextOptions {
  session: AuthSession | null;
}

export async function createContext({ session }: CreateContextOptions): Promise<Context> {
  const userId = session?.user?.id;
  const isGlobalAdmin = userId
    ? (await db.barnMembership.findFirst({
        where: { userId, role: "GLOBAL_ADMIN" },
      })) !== null
    : false;

  return { db, session, isGlobalAdmin };
}
