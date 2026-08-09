import { z } from "zod";

// Weight/height units for MEASUREMENT ledger entries. Values are stored
// canonically (kg / cm) so the growth chart has one consistent scale; the unit
// the user typed is stored alongside so the ledger reads back what they entered.
//
// Lives here rather than in an app because packages/validators is the only
// package both apps and the tRPC routers import (same reason tags.ts lives here).

export const WEIGHT_UNITS = ["KG", "LB"] as const;
export const HEIGHT_UNITS = ["HANDS", "CM", "IN"] as const;

export const weightUnitEnum = z.enum(WEIGHT_UNITS);
export const heightUnitEnum = z.enum(HEIGHT_UNITS);

export type WeightUnit = z.infer<typeof weightUnitEnum>;
export type HeightUnit = z.infer<typeof heightUnitEnum>;

const LB_PER_KG = 0.45359237;
const CM_PER_IN = 2.54;
const IN_PER_HAND = 4;

// --- Hands ---------------------------------------------------------------------
// The one genuinely counter-intuitive unit here. In horse notation "15.2hh" is
// 15 hands AND 2 inches — not 15.2 hands. So the fractional digit is a count of
// inches and can only be 0-3; 15.4hh is not a number anyone writes (that's 16hh).
// Reading it as a plain decimal gives 154.4cm instead of 157.48cm — a 3cm error
// that silently corrupts every height chart.

/** True when `value` is valid hands notation (fractional digit 0-3). */
export function isValidHands(value: number): boolean {
  if (!Number.isFinite(value) || value < 0) return false;
  // Compare in tenths to dodge float representation (15.2 * 10 = 151.99...).
  const tenths = Math.round(value * 10);
  if (Math.abs(value * 10 - tenths) > 1e-6) return false; // more than 1 decimal
  return tenths % 10 <= 3;
}

/** "15.2" (15 hands 2 inches) -> 62 total inches. */
export function handsToInches(value: number): number {
  const whole = Math.floor(value + 1e-9);
  const inches = Math.round((value - whole) * 10);
  return whole * IN_PER_HAND + inches;
}

/** 62 total inches -> 15.2 (15 hands 2 inches). */
export function inchesToHands(inches: number): number {
  const whole = Math.floor(inches / IN_PER_HAND);
  const rem = Math.round(inches - whole * IN_PER_HAND);
  // A remainder of 4 would render as "15.4"; carry it into the next hand.
  return rem >= IN_PER_HAND ? whole + 1 : whole + rem / 10;
}

// --- Conversions ---------------------------------------------------------------

export function toKg(value: number, unit: WeightUnit): number {
  return unit === "KG" ? value : value * LB_PER_KG;
}

export function fromKg(kg: number, unit: WeightUnit): number {
  return unit === "KG" ? kg : kg / LB_PER_KG;
}

export function toCm(value: number, unit: HeightUnit): number {
  if (unit === "CM") return value;
  if (unit === "IN") return value * CM_PER_IN;
  return handsToInches(value) * CM_PER_IN;
}

export function fromCm(cm: number, unit: HeightUnit): number {
  if (unit === "CM") return cm;
  if (unit === "IN") return cm / CM_PER_IN;
  return inchesToHands(cm / CM_PER_IN);
}

// --- Display -------------------------------------------------------------------

const round = (n: number, places: number) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};

/** Canonical kg -> a display string in `unit`, e.g. "1200 lb". */
export function formatWeight(kg: number, unit: WeightUnit = "KG"): string {
  const value = round(fromKg(kg, unit), 1);
  return `${value} ${unit === "KG" ? "kg" : "lb"}`;
}

/** Canonical cm -> a display string in `unit`, e.g. "15.2hh" or "157.5 cm". */
export function formatHeight(cm: number, unit: HeightUnit = "CM"): string {
  if (unit === "HANDS") return `${round(fromCm(cm, "HANDS"), 1)}hh`;
  return `${round(fromCm(cm, unit), 1)} ${unit === "CM" ? "cm" : "in"}`;
}

// --- Chart helpers -------------------------------------------------------------

/**
 * Padded min/max for a chart axis. Shared by the web and mobile growth charts so
 * both scale identically. A single point (or many identical ones) would produce
 * a zero-height range and divide-by-zero when normalizing, so pad it out.
 */
export function chartBounds(values: number[]): { min: number; max: number } {
  const usable = values.filter((v) => Number.isFinite(v));
  if (usable.length === 0) return { min: 0, max: 1 };
  let min = Math.min(...usable);
  let max = Math.max(...usable);
  if (max === min) {
    const pad = Math.abs(max) * 0.05 || 1;
    return { min: min - pad, max: max + pad };
  }
  const pad = (max - min) * 0.1;
  return { min: min - pad, max: max + pad };
}

/**
 * A ledger `occurredAt` is a date-only column, which Prisma serializes as an ISO
 * datetime at UTC midnight ("2026-02-01T00:00:00.000Z"). Feeding that straight to
 * `new Date(...)` and formatting it renders the PREVIOUS day everywhere west of
 * UTC — the same local-midnight gotcha documented in CLAUDE.md. Take the calendar
 * date and rebuild it at local midnight so charts label the day that was entered.
 *
 * Shared so the web and mobile charts can't disagree about what day a point is.
 */
export function dateOnlyToLocal(value: string | Date): Date {
  if (typeof value === "string") {
    // Matches both "YYYY-MM-DD" and the leading date of a full ISO timestamp.
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const d = new Date(value);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Position of `value` within `bounds` as 0..1 (0 = min). */
export function normalize(value: number, bounds: { min: number; max: number }): number {
  const span = bounds.max - bounds.min;
  if (span <= 0) return 0.5;
  return (value - bounds.min) / span;
}
