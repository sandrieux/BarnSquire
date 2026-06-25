import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      mustChangePassword?: boolean;
      locale?: string;
    } & DefaultSession["user"];
  }

  interface User {
    mustChangePassword?: boolean;
    locale?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    mustChangePassword?: boolean;
    locale?: string;
  }
}
