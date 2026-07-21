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
  mustChangePassword: boolean;
}

export interface AuthenticatedContext extends Context {
  session: AuthenticatedSession;
}

export interface CreateContextOptions {
  session: AuthSession | null;
}

export async function createContext({ session }: CreateContextOptions): Promise<Context> {
  const userId = session?.user?.id;
  // System-admin authority comes ONLY from User.isSystemAdmin — never from a
  // barn membership role. barn.create grants a per-barn GLOBAL_ADMIN membership
  // (barn owner); deriving global admin from that would let any user self-
  // promote by creating a throwaway barn.
  const user = userId
    ? await db.user.findUnique({
        where: { id: userId },
        select: { isSystemAdmin: true, mustChangePassword: true },
      })
    : null;

  return {
    db,
    session,
    isGlobalAdmin: user?.isSystemAdmin ?? false,
    mustChangePassword: user?.mustChangePassword ?? false,
  };
}
