import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { auth } from "@/lib/auth";
import { DEFAULT_LOCALE, isSupportedLocale, negotiateLocale, type Locale } from "./config";

// Resolve the active locale per request:
//   NEXT_LOCALE cookie → saved user preference → Accept-Language → default.
async function resolveLocale(): Promise<Locale> {
  const cookieLocale = (await cookies()).get("NEXT_LOCALE")?.value;
  if (isSupportedLocale(cookieLocale)) return cookieLocale;

  try {
    const session = await auth();
    if (isSupportedLocale(session?.user?.locale)) return session.user.locale as Locale;
  } catch {
    // auth() may be unavailable in some contexts; fall through to header negotiation.
  }

  const acceptLanguage = (await headers()).get("accept-language");
  return negotiateLocale(acceptLanguage) ?? DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  const messages = (await import(`../messages/${locale}.json`)).default;
  return { locale, messages };
});
