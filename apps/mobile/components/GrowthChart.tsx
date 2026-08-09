import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  chartBounds,
  dateOnlyToLocal,
  fromCm,
  fromKg,
  normalize,
  type HeightUnit,
  type WeightUnit,
} from "@barnsquire/validators";
import { trpc } from "../lib/trpc";
import { colors, taskColors } from "../lib/theme";

// Drawn with plain Views on purpose: react-native-svg is a native module, and
// adding one would force a version bump + a full EAS build + a TestFlight
// round-trip before anyone saw this. Views ship over-the-air to the installed
// binary. Line segments are 1px Views rotated to connect adjacent points.

const PLOT_H = 140;
const DOT = 7;

const WEIGHT_COLOR = colors.primary;
const HEIGHT_COLOR = taskColors.EXERCISE!; // amber — unused elsewhere on this screen

type Row = {
  date: string | Date;
  weightKg: number | null;
  weightUnit: string | null;
  heightCm: number | null;
  heightUnit: string | null;
};

type Pt = { x: number; y: number };

function toPoints(
  rows: Array<{ t: number; value: number | null }>,
  width: number,
  tMin: number,
  tMax: number,
): Pt[] {
  const present = rows.filter((r) => r.value != null) as Array<{ t: number; value: number }>;
  if (present.length === 0 || width <= 0) return [];
  const bounds = chartBounds(present.map((r) => r.value));
  return present.map((r) => ({
    // A single day of data has no span — centre it instead of dividing by zero.
    x: tMax === tMin ? width / 2 : ((r.t - tMin) / (tMax - tMin)) * width,
    y: (1 - normalize(r.value, bounds)) * PLOT_H,
  }));
}

export function GrowthChart({ animalId }: { animalId: string }) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const { data, isLoading } = trpc.ledger.getMeasurements.useQuery(
    { animalId },
    { enabled: !!animalId },
  );

  const rows = (data ?? []) as Row[];
  // Date-only value rebuilt at LOCAL midnight — see dateOnlyToLocal.
  const points = rows.map((r) => ({
    t: dateOnlyToLocal(r.date as string).getTime(),
    weight: r.weightKg,
    height: r.heightCm,
  }));

  const body = () => {
    if (isLoading) return <Text style={styles.muted}>{t("ledger.loading")}</Text>;
    if (points.length === 0) return <Text style={styles.muted}>{t("ledger.noMeasurements")}</Text>;

    const times = points.map((p) => p.t);
    const tMin = Math.min(...times);
    const tMax = Math.max(...times);
    const weightPts = toPoints(
      points.map((p) => ({ t: p.t, value: p.weight })),
      width,
      tMin,
      tMax,
    );
    const heightPts = toPoints(
      points.map((p) => ({ t: p.t, value: p.height })),
      width,
      tMin,
      tMax,
    );

    const weightUnit = ([...rows].reverse().find((r) => r.weightUnit)?.weightUnit ??
      "KG") as WeightUnit;
    const heightUnit = ([...rows].reverse().find((r) => r.heightUnit)?.heightUnit ??
      "CM") as HeightUnit;
    const lastWeight = lastOf(points, "weight");
    const lastHeight = lastOf(points, "height");

    return (
      <>
        <View style={styles.legendRow}>
          {lastWeight != null && (
            <Legend
              color={WEIGHT_COLOR}
              label={t("ledger.weight")}
              value={`${round(fromKg(lastWeight, weightUnit))} ${t(`ledger.units.${weightUnit}`)}`}
            />
          )}
          {lastHeight != null && (
            <Legend
              color={HEIGHT_COLOR}
              label={t("ledger.height")}
              value={
                heightUnit === "HANDS"
                  ? `${round(fromCm(lastHeight, "HANDS"))}${t("ledger.units.HANDS")}`
                  : `${round(fromCm(lastHeight, heightUnit))} ${t(`ledger.units.${heightUnit}`)}`
              }
            />
          )}
        </View>

        <View style={styles.plot} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <View key={f} style={[styles.gridline, { top: f * PLOT_H }]} />
          ))}
          <Series points={weightPts} color={WEIGHT_COLOR} />
          <Series points={heightPts} color={HEIGHT_COLOR} />
        </View>

        <View style={styles.axisRow}>
          <Text style={styles.axisLabel}>{shortDate(tMin)}</Text>
          {tMax !== tMin && <Text style={styles.axisLabel}>{shortDate(tMax)}</Text>}
        </View>
      </>
    );
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("ledger.growth")}</Text>
      {body()}
    </View>
  );
}

/** Dots plus rotated 1px Views standing in for line segments. */
function Series({ points, color }: { points: Pt[]; color: string }) {
  if (points.length === 0) return null;
  return (
    <>
      {points.slice(0, -1).map((p, i) => {
        const q = points[i + 1]!;
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const len = Math.hypot(dx, dy);
        if (len === 0) return null;
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        return (
          <View
            key={`seg-${i}`}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              width: len,
              height: 2,
              backgroundColor: color,
              // Rotate about the left edge so the segment starts exactly on the point.
              transform: [{ translateX: len / 2 }, { rotate: `${angle}deg` }, { translateX: -len / 2 }],
            }}
          />
        );
      })}
      {points.map((p, i) => (
        <View
          key={`dot-${i}`}
          style={{
            position: "absolute",
            left: p.x - DOT / 2,
            top: p.y - DOT / 2,
            width: DOT,
            height: DOT,
            borderRadius: 999,
            backgroundColor: color,
          }}
        />
      ))}
    </>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={styles.legend}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
      <Text style={styles.legendValue}>{value}</Text>
    </View>
  );
}

const round = (n: number) => Math.round(n * 10) / 10;

// formatDate in lib/dates.ts always includes the year, which is too wide for a
// tick label on a phone.
const shortDate = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });

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

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  title: { fontSize: 16, fontWeight: "700", color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  legend: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 999 },
  legendLabel: { fontSize: 13, color: colors.muted },
  legendValue: { fontSize: 13, fontWeight: "700", color: colors.text },
  plot: { height: PLOT_H, marginTop: 4, position: "relative" },
  gridline: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.border,
  },
  axisRow: { flexDirection: "row", justifyContent: "space-between" },
  axisLabel: { fontSize: 11, color: colors.muted },
});
