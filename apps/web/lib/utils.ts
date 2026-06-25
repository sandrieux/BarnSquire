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
