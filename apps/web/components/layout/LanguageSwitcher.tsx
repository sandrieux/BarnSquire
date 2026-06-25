"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Select } from "@/components/ui/select";
import { setLocale } from "@/app/actions/locale";
import { SUPPORTED_LOCALES } from "@/i18n/config";

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("language");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <Select
      value={locale}
      onChange={onChange}
      disabled={pending}
      aria-label={t("label")}
      className={className ?? "h-9 w-auto"}
    >
      {SUPPORTED_LOCALES.map((l) => (
        <option key={l} value={l}>
          {t(l)}
        </option>
      ))}
    </Select>
  );
}
