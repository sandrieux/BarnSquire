"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export function ChangePasswordForm({ forced = false }: { forced?: boolean }) {
  const t = useTranslations("auth");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const changePassword = trpc.user.changePassword.useMutation({
    onSuccess: () => {
      setDone(true);
      // Force a fresh sign-in so the new session no longer requires a change.
      setTimeout(() => signOut({ callbackUrl: "/login" }), 1200);
    },
    onError: (e) =>
      setError(e.message === "CURRENT_PASSWORD_INVALID" ? t("currentPasswordWrong") : e.message),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const currentPassword = form.get("currentPassword") as string | null;
    const newPassword = form.get("newPassword") as string;
    const confirm = form.get("confirm") as string;
    if (newPassword.length < 8) return setError(t("passwordTooShort"));
    if (newPassword !== confirm) return setError(t("passwordsNoMatch"));
    // Self-service changes must re-authenticate; the forced first-login flow does not.
    if (!forced && !currentPassword) return setError(t("currentPasswordRequired"));
    changePassword.mutate({ newPassword, currentPassword: currentPassword ?? undefined });
  }

  if (done) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          {t("passwordUpdated")}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {!forced && (
            <div className="space-y-2">
              <Label htmlFor="currentPassword">{t("currentPassword")}</Label>
              <Input id="currentPassword" name="currentPassword" type="password" required placeholder="••••••••" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="newPassword">{t("newPassword")}</Label>
            <Input id="newPassword" name="newPassword" type="password" required placeholder="••••••••" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">{t("confirmNewPassword")}</Label>
            <Input id="confirm" name="confirm" type="password" required placeholder="••••••••" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={changePassword.isPending}>
            {changePassword.isPending ? t("saving") : t("setPassword")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
