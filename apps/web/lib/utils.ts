import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string, locale = "en-US") {
  return new Date(date).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(date: Date | string, locale = "en-US") {
  return new Date(date).toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function todayDateString() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

// Current date in a given IANA timezone as "YYYY-MM-DD". Deterministic on both
// server and client (independent of the host/container or browser timezone) —
// "en-CA" formats as YYYY-MM-DD.
export function todayInTimeZone(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Add (or subtract) whole days to a "YYYY-MM-DD" string using UTC arithmetic so
// the result never shifts due to the local timezone.
export function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + delta)).toISOString().slice(0, 10);
}

// Current hour/minute in a given timezone (24h), for time-of-day logic.
export function hourMinuteInTimeZone(timeZone: string): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const hour = get("hour") % 24; // "24" can appear at midnight in some environments
  return { hour, minute: get("minute") };
}
