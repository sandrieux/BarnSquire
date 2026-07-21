import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Screen } from "../../components/Screen";
import { BarnSwitcher } from "../../components/BarnSwitcher";
import { Card, EmptyState, ErrorNote, Loading } from "../../components/ui";
import { useBarn } from "../../lib/barn";
import { trpc } from "../../lib/trpc";
import { formatDate, todayInTimeZone } from "../../lib/dates";
import { completionKeyFor } from "../../lib/tasks";
import { colors } from "../../lib/theme";

const PREP_SLOTS = ["MORNING", "LUNCH", "AFTERNOON", "EVENING"] as const;

interface FeedTask {
  id: string;
  taskType: "FEEDING" | "MEDICATION";
  animalId: string;
  animalName: string;
  slot: string;
  feedType?: string | null;
  quantity?: string | null;
  unit?: string | null;
  instructions?: string | null;
  completion?: { skipped?: boolean } | null;
}

// Mirrors the server's free-text quantity parsing: a leading number, else 1.
function parseQuantity(q?: string | null): number {
  if (!q) return 1;
  const n = parseFloat(q);
  return Number.isNaN(n) ? 1 : n;
}

export default function PrepScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { barnId, timezone } = useBarn();
  const date = todayInTimeZone(timezone);

  const utils = trpc.useUtils();
  const q = trpc.today.getDailyView.useQuery(
    { barnId: barnId ?? "", date },
    { enabled: !!barnId },
  );
  const invalidate = () => utils.today.getDailyView.invalidate({ barnId: barnId ?? "", date });
  const complete = trpc.today.completeTask.useMutation({ onSettled: invalidate });
  const uncomplete = trpc.today.uncompleteTask.useMutation({ onSettled: invalidate });
  const [overlay, setOverlay] = useState<Record<string, boolean>>({});

  const feedTasks = useMemo(() => {
    const items: FeedTask[] = [];
    for (const g of q.data ?? []) {
      for (const task of g.tasks) {
        if (task.taskType === "FEEDING" || task.taskType === "MEDICATION") {
          items.push(task as unknown as FeedTask);
        }
      }
    }
    return items;
  }, [q.data]);

  const isDone = (task: FeedTask) => {
    const o = overlay[task.id];
    if (o !== undefined) return o;
    return !!task.completion && !task.completion.skipped;
  };

  function toggle(task: FeedTask) {
    if (!barnId) return;
    const key = completionKeyFor(task.taskType, task.id);
    const next = !isDone(task);
    setOverlay((prev) => ({ ...prev, [task.id]: next }));
    if (next) {
      complete.mutate({
        barnId,
        date,
        taskType: task.taskType,
        ...(task.animalId ? { animalId: task.animalId } : {}),
        ...key,
      });
    } else {
      uncomplete.mutate({ barnId, date, ...key });
    }
  }

  return (
    <Screen title={t("foodPrep.title")} subtitle={formatDate(date, locale)} right={<BarnSwitcher />}>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorNote message={q.error.message} />
      ) : feedTasks.length === 0 ? (
        <EmptyState text={t("today.noTasks")} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {PREP_SLOTS.map((slot) => {
            const tasks = feedTasks.filter((task) => task.slot === slot);
            if (tasks.length === 0) return null;

            // Aggregate "what to prepare": total quantity per feed type.
            const totals = new Map<string, { total: number; unit: string | null; count: number }>();
            for (const task of tasks) {
              const key = task.feedType ?? "—";
              const prev = totals.get(key) ?? { total: 0, unit: task.unit ?? null, count: 0 };
              prev.total += parseQuantity(task.quantity);
              prev.unit = prev.unit ?? task.unit ?? null;
              prev.count += 1;
              totals.set(key, prev);
            }

            return (
              <View key={slot} style={styles.slotSection}>
                <Text style={styles.slotTitle}>{t(`today.slots.${slot}`)}</Text>

                {/* prep totals */}
                <Card style={styles.prepCard}>
                  {[...totals.entries()].map(([feedType, agg]) => (
                    <View key={feedType} style={styles.prepRow}>
                      <Text style={styles.prepFeed}>{feedType}</Text>
                      <Text style={styles.prepQty}>
                        {Number.isInteger(agg.total) ? agg.total : agg.total.toFixed(1)}
                        {agg.unit ? ` ${agg.unit}` : ""}
                        <Text style={styles.prepCount}>{`  ·  ${agg.count}`}</Text>
                      </Text>
                    </View>
                  ))}
                </Card>

                {/* distribution checklist */}
                {tasks.map((task) => {
                  const done = isDone(task);
                  return (
                    <Pressable key={`${task.taskType}-${task.id}`} onPress={() => toggle(task)}>
                      <Card style={styles.distRow}>
                        <Ionicons
                          name={done ? "checkmark-circle" : "ellipse-outline"}
                          size={24}
                          color={done ? colors.success : colors.border}
                        />
                        <View style={styles.distBody}>
                          <Text style={[styles.distAnimal, done && styles.doneText]}>
                            {task.animalName}
                          </Text>
                          <Text style={styles.distFeed}>
                            {task.feedType}
                            {task.quantity ? ` — ${task.quantity}${task.unit ? ` ${task.unit}` : ""}` : ""}
                          </Text>
                          {task.instructions ? (
                            <Text style={styles.distInstr}>{task.instructions}</Text>
                          ) : null}
                        </View>
                      </Card>
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  slotSection: { marginBottom: 22, gap: 8 },
  slotTitle: { fontSize: 15, fontWeight: "800", color: colors.text, textTransform: "uppercase" },
  prepCard: { backgroundColor: "#f1f5f9", gap: 6 },
  prepRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  prepFeed: { fontSize: 15, fontWeight: "700", color: colors.text },
  prepQty: { fontSize: 15, fontWeight: "700", color: colors.primary },
  prepCount: { color: colors.muted, fontWeight: "500" },
  distRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  distBody: { flexShrink: 1, gap: 2 },
  distAnimal: { fontSize: 15, fontWeight: "600", color: colors.text },
  doneText: { textDecorationLine: "line-through", color: colors.muted },
  distFeed: { fontSize: 13, color: colors.muted },
  distInstr: { fontSize: 12, color: colors.muted, fontStyle: "italic" },
});
