"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { User, ChevronDown, KeyRound, LogOut, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { setLocale } from "@/app/actions/locale";
import { SUPPORTED_LOCALES } from "@/i18n/config";

export function UserMenu({
  userName,
  userEmail,
}: {
  userName?: string | null;
  userEmail?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const locale = useLocale();
  const tTop = useTranslations("topnav");
  const tLang = useTranslations("language");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function chooseLocale(next: string) {
    if (next !== locale) {
      startTransition(async () => {
        await setLocale(next);
        router.refresh();
      });
    }
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <User className="h-4 w-4" />
        <span className="hidden sm:inline max-w-[160px] truncate">{userName}</span>
        <ChevronDown className="h-4 w-4 opacity-60 shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 top-9 z-50 min-w-[220px] rounded-md border bg-popover py-1 text-sm shadow-md"
          >
            <div className="border-b px-3 py-2">
              <p className="font-medium truncate">{userName}</p>
              {userEmail && <p className="text-xs text-muted-foreground truncate">{userEmail}</p>}
            </div>

            <Link
              href="/change-password"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 hover:bg-accent"
            >
              <KeyRound className="h-4 w-4" />
              {tTop("changePassword")}
            </Link>

            <div className="mt-1 border-t pt-1">
              <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {tLang("label")}
              </p>
              {SUPPORTED_LOCALES.map((l) => (
                <button
                  key={l}
                  onClick={() => chooseLocale(l)}
                  disabled={pending}
                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-accent disabled:opacity-50"
                >
                  <span className={cn(l === locale && "font-semibold text-primary")}>{tLang(l)}</span>
                  {l === locale && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>

            <div className="mt-1 border-t pt-1">
              <button
                onClick={() => {
                  setOpen(false);
                  signOut({ callbackUrl: "/login" });
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-destructive hover:bg-accent"
              >
                <LogOut className="h-4 w-4" />
                {tTop("signOut")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
