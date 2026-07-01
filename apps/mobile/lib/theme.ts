// Shared visual tokens. Task-type colors mirror the web Today view.
export const colors = {
  bg: "#f8fafc",
  card: "#ffffff",
  border: "#e2e8f0",
  text: "#0f172a",
  muted: "#64748b",
  primary: "#2563eb",
  primaryText: "#ffffff",
  danger: "#dc2626",
  success: "#16a34a",
  warnBg: "#fffbeb",
  warnBorder: "#fde68a",
  warnText: "#92400e",
};

export const taskColors: Record<string, string> = {
  FEEDING: "#16a34a",
  MEDICATION: "#ea580c",
  APPOINTMENT: "#2563eb",
  TURNOUT: "#7c3aed",
  EXERCISE: "#d97706",
  SCHEDULED_EVENT: "#475569",
};

export const SLOTS = ["ALL", "MORNING", "LUNCH", "AFTERNOON", "EVENING"] as const;
export type SlotFilter = (typeof SLOTS)[number];
