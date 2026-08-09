"use client";

import { useTranslations, useLocale } from "next-intl";
import {
  chartBounds,
  dateOnlyToLocal,
  fromCm,
  fromKg,
  normalize,
  type HeightUnit,
  type WeightUnit,
} from "@barnsquire/validators";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Hand-rolled inline SVG rather than a charting dependency — this is one basic
// two-series plot and the mobile app has to draw the same thing with plain
// Views, so neither side gains from a library.

const VB_W = 640;
const VB_H = 220;
const PAD = { top: 14, right: 12, bottom: 26, left: 12 };
const PLOT_W = VB_W - PAD.left - PAD.right;
const PLOT_H = VB_H - PAD.top - PAD.bottom;

const WEIGHT_COLOR = "hsl(var(--primary))";
const HEIGHT_COLOR = "#0891b2"; // cyan-600 — distinct from the amber primary

type Point = { x: number; y: number };

/** Screen-space points for one series, skipping entries missing that value. */
function seriesPoints(
  rows: Array<{ t: number; value: number | null }>,
  xOf: (t: number) => number,
): Point[] {
  const present = rows.filter((r) => r.value != null) as Array<{ t: number; value: number }>;
  if (present.length === 0) return [];
  const bounds = chartBounds(present.map((r) => r.value));
  return present.map((r) => ({
    x: xOf(r.t),
    // SVG y grows downward, so invert the normalized position.
    y: PAD.top + (1 - normalize(r.value, bounds)) * PLOT_H,
  }));
}

export function GrowthChart({ animalId }: { animalId: string }) {
  const t = useTranslations("ledger");
  const locale = useLocale();
  const { data, isLoading } = trpc.ledger.getMeasurements.useQuery({ animalId });

  const rows = data ?? [];

  // occurredAt is date-only; dateOnlyToLocal rebuilds it at LOCAL midnight so the
  // axis doesn't label the previous day west of UTC.
  const points = rows.map((r) => ({
    t: dateOnlyToLocal(r.date as unknown as string).getTime(),
    weight: r.weightKg,
    height: r.heightCm,
  }));

  const hasWeight = points.some((p) => p.weight != null);
  const hasHeight = points.some((p) => p.height != null);

  // Units follow the most recent entry that specified one.
  const weightUnit = ([...rows].reverse().find((r) => r.weightUnit)?.weightUnit ??
    "KG") as WeightUnit;
  const heightUnit = ([...rows].reverse().find((r) => r.heightUnit)?.heightUnit ??
    "CM") as HeightUnit;

  const times = points.map((p) => p.t);
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  // A single measurement (or several on one day) has no time span — centre it
  // rather than dividing by zero.
  const xOf = (time: number) =>
    tMax === tMin ? PAD.left + PLOT_W / 2 : PAD.left + ((time - tMin) / (tMax - tMin)) * PLOT_W;

  const weightPts = seriesPoints(
    points.map((p) => ({ t: p.t, value: p.weight })),
    xOf,
  );
  const heightPts = seriesPoints(
    points.map((p) => ({ t: p.t, value: p.height })),
    xOf,
  );

  const fmtDate = (ms: number) =>
    new Date(ms).toLocaleDateString(locale, { month: "short", day: "numeric" });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("growth")}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        ) : points.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noMeasurements")}</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-4 text-sm mb-2">
              {hasWeight && (
                <Legend
                  color={WEIGHT_COLOR}
                  label={t("weight")}
                  value={`${round(fromKg(lastOf(points, "weight")!, weightUnit))} ${unitLabel(weightUnit)}`}
                />
              )}
              {hasHeight && (
                <Legend
                  color={HEIGHT_COLOR}
                  label={t("height")}
                  value={formatHeightShort(lastOf(points, "height")!, heightUnit)}
                />
              )}
            </div>

            <svg
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              className="w-full h-auto"
              role="img"
              aria-label={t("growth")}
            >
              {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                <line
                  key={f}
                  x1={PAD.left}
                  x2={PAD.left + PLOT_W}
                  y1={PAD.top + f * PLOT_H}
                  y2={PAD.top + f * PLOT_H}
                  stroke="hsl(var(--border))"
                  strokeWidth={1}
                />
              ))}

              <Series points={weightPts} color={WEIGHT_COLOR} />
              <Series points={heightPts} color={HEIGHT_COLOR} />

              <text
                x={PAD.left}
                y={VB_H - 6}
                className="fill-muted-foreground"
                fontSize={12}
              >
                {fmtDate(tMin)}
              </text>
              {tMax !== tMin && (
                <text
                  x={PAD.left + PLOT_W}
                  y={VB_H - 6}
                  textAnchor="end"
                  className="fill-muted-foreground"
                  fontSize={12}
                >
                  {fmtDate(tMax)}
                </text>
              )}
            </svg>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Polyline plus a dot per point; a lone point renders as just the dot. */
function Series({ points, color }: { points: Point[]; color: string }) {
  if (points.length === 0) return null;
  return (
    <g>
      {points.length > 1 && (
        <polyline
          points={points.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={color} />
      ))}
    </g>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

const round = (n: number) => Math.round(n * 10) / 10;
const unitLabel = (u: WeightUnit) => (u === "KG" ? "kg" : "lb");

function formatHeightShort(cm: number, unit: HeightUnit): string {
  if (unit === "HANDS") return `${round(fromCm(cm, "HANDS"))}hh`;
  return `${round(fromCm(cm, unit))} ${unit === "CM" ? "cm" : "in"}`;
}

/** Most recent non-null value for a series (the latest row may omit it). */
function lastOf(
  points: Array<{ weight: number | null; height: number | null }>,
  key: "weight" | "height",
): number | null {
  for (let i = points.length - 1; i >= 0; i--) {
    const v = points[i]![key];
    if (v != null) return v;
  }
  return null;
}
