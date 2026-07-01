"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

// A curated set of IANA zones; the barn's current value is always included.
const COMMON_TIMEZONES = [
  "UTC",
  "America/St_Johns",
  "America/Halifax",
  "America/New_York",
  "America/Toronto",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export function BarnSettingsForm({
  barnId,
  barn,
}: {
  barnId: string;
  barn: { name: string; address: string | null; timezone: string };
}) {
  const t = useTranslations("settings");
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const update = trpc.barn.update.useMutation({
    onSuccess: () => {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (e) => setError(e.message),
  });

  const zones = COMMON_TIMEZONES.includes(barn.timezone)
    ? COMMON_TIMEZONES
    : [barn.timezone, ...COMMON_TIMEZONES];

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaved(false);
    const form = new FormData(e.currentTarget);
    const name = (form.get("name") as string).trim();
    if (!name) return setError("Name is required");
    update.mutate({
      barnId,
      name,
      address: (form.get("address") as string).trim() || undefined,
      timezone: form.get("timezone") as string,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="barn-name">{t("name")}</Label>
        <Input id="barn-name" name="name" required defaultValue={barn.name} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="barn-address">{t("address")}</Label>
        <Input id="barn-address" name="address" defaultValue={barn.address ?? ""} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="barn-timezone">{t("timezone")}</Label>
        <Select id="barn-timezone" name="timezone" defaultValue={barn.timezone}>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </Select>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={update.isPending}>
          {update.isPending ? t("saving") : t("save")}
        </Button>
        {saved && <span className="text-sm text-green-700">{t("saved")}</span>}
      </div>
    </form>
  );
}
