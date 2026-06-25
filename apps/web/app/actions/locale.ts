"use server";

import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { createServerCaller } from "@/lib/trpc/server";
import { isSupportedLocale } from "@/i18n/config";

// Sets the locale cookie (immediate effect) and, when signed in, persists it as
// the user's preference via tRPC. Used by the language switcher pre- and post-auth.
export async function setLocale(locale: string) {
  if (!isSupportedLocale(locale)) return;

  (await cookies()).set("NEXT_LOCALE", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  const session = await auth();
  if (session?.user) {
    try {
      const caller = await createServerCaller();
      await caller.user.setLocale({ locale });
    } catch {
      // Cookie already applied; ignore preference-persistence failures.
    }
  }
}
