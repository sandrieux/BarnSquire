// Timezone-safe date helpers, mirrored from the web app (apps/web/lib/utils.ts)
// and the server slot windows (packages/trpc/src/router/today.ts timeToSlot).
// A calendar-day "YYYY-MM-DD" string is parsed as LOCAL midnight for display so
// it never renders a day early (the UTC-midnight gotcha in CLAUDE.md).
//
// NOTE: relies on Intl.DateTimeFormat timezone support (present in Hermes on
// modern Expo). If a target device lacks it, add an Intl polyfill.

export type Slot = "MORNING" | "LUNCH" | "AFTERNOON" | "EVENING";

export function todayInTimeZone(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + delta)).toISOString().slice(0, 10);
}

function hourInTimeZone(timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  return Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
}

// Current time-of-day slot in the barn's zone. Windows match the server's
// timeToSlot: Morning 06–12, Lunch 12–13, Afternoon 13–18, else Evening.
export function currentSlot(timeZone: string): Slot {
  const h = hourInTimeZone(timeZone);
  if (h >= 6 && h < 12) return "MORNING";
  if (h >= 12 && h < 13) return "LUNCH";
  if (h >= 13 && h < 18) return "AFTERNOON";
  return "EVENING";
}

function toDisplayDate(date: string | Date): Date {
  if (typeof date === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return new Date(date);
}

export function formatDate(date: string | Date, locale = "en-US"): string {
  return toDisplayDate(date).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(date: string | Date, locale = "en-US"): string {
  return new Date(date).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}
