export const SUPPORTED_LOCALES = ["en", "fr-CA", "fr-FR"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

// Browser sends just "fr" — pick a sensible default French variant.
const LANGUAGE_FALLBACK: Record<string, Locale> = { fr: "fr-FR" };

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

// Pick the best supported locale from an Accept-Language header, e.g.
// "fr-CA,fr;q=0.9,en;q=0.8" → "fr-CA".
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const tags = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag?.trim() ?? "", q: q ? parseFloat(q) : 1 };
    })
    .filter((t) => t.tag)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of tags) {
    if (isSupportedLocale(tag)) return tag;
    const primary = tag.split("-")[0]?.toLowerCase() ?? "";
    if (LANGUAGE_FALLBACK[primary]) return LANGUAGE_FALLBACK[primary];
  }
  return DEFAULT_LOCALE;
}
