import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Screen } from "../../components/Screen";
import { BarnSwitcher } from "../../components/BarnSwitcher";
import { AccountMenu } from "../../components/AccountMenu";
import { Badge, Card, EmptyState, ErrorNote, Loading } from "../../components/ui";
import { useBarn } from "../../lib/barn";
import { trpc } from "../../lib/trpc";
import { addDays, currentSlot, formatDate, todayInTimeZone } from "../../lib/dates";
import { completionKeyFor, type TaskType } from "../../lib/tasks";
import { colors, SLOTS, taskColors, type SlotFilter } from "../../lib/theme";

type EffStatus = "done" | "skipped" | "none";

export default function TodayScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const router = useRouter();
  const { barnId, timezone } = useBarn();

  const today = todayInTimeZone(timezone);
  const [date, setDate] = useState(today);
  const [slot, setSlot] = useState<SlotFilter>(() => currentSlot(timezone));
  const [overlay, setOverlay] = useState<Record<string, EffStatus>>({});
  const navigatedRef = useRef(false);

  // Until the user browses to another day, keep "date" pinned to the barn's
  // current day — important because the barn timezone resolves after first render.
  useEffect(() => {
    if (!navigatedRef.current) setDate(today);
  }, [today]);

  const isToday = date === today;
  const utils = trpc.useUtils();

  const groupsQuery = trpc.today.getDailyView.useQuery(
    { barnId: barnId ?? "", date },
    { enabled: !!barnId },
  );
  const refills = trpc.feedStock.getRefillsDue.useQuery(
    { barnId: barnId ?? "" },
    { enabled: !!barnId },
  );

  const invalidate = () => utils.today.getDailyView.invalidate({ barnId: barnId ?? "", date });
  const complete = trpc.today.completeTask.useMutation({ onSettled: invalidate });
  const uncomplete = trpc.today.uncompleteTask.useMutation({ onSettled: invalidate });
  const skip = trpc.today.skipTask.useMutation({ onSettled: invalidate });

  const groups = groupsQuery.data ?? [];

  const effStatus = (task: {
    id: string;
    completion?: { skipped?: boolean } | null;
  }): EffStatus => {
    const o = overlay[task.id];
    if (o) return o;
    if (task.completion) return task.completion.skipped ? "skipped" : "none";
    if (task.completion === undefined || task.completion === null) return "none";
    return "none";
  };
  // completion present & not skipped means done
  const isDone = (task: { id: string; completion?: { skipped?: boolean } | null }) => {
    const o = overlay[task.id];
    if (o) return o === "done";
    return !!task.completion && !task.completion.skipped;
  };

  const { done, total } = useMemo(() => {
    let d = 0;
    let n = 0;
    for (const g of groups) {
      for (const task of g.tasks) {
        n += 1;
        if (isDone(task) || effStatus(task) === "skipped") d += 1;
      }
    }
    return { done: d, total: n };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, overlay]);

  function setOverlayFor(id: string, status: EffStatus) {
    setOverlay((prev) => ({ ...prev, [id]: status }));
  }

  function toggle(task: {
    id: string;
    taskType: TaskType;
    animalId: string;
  }) {
    if (!barnId) return;
    const key = completionKeyFor(task.taskType, task.id);
    if (isDone(task)) {
      setOverlayFor(task.id, "none");
      uncomplete.mutate({ barnId, date, ...key });
    } else {
      setOverlayFor(task.id, "done");
      complete.mutate({
        barnId,
        date,
        taskType: task.taskType,
        ...(task.animalId ? { animalId: task.animalId } : {}),
        ...key,
      });
    }
  }

  function onSkip(task: { id: string; taskType: TaskType; animalId: string }) {
    if (!barnId) return;
    const key = completionKeyFor(task.taskType, task.id);
    setOverlayFor(task.id, "skipped");
    skip.mutate({
      barnId,
      date,
      taskType: task.taskType,
      ...(task.animalId ? { animalId: task.animalId } : {}),
      ...key,
    });
  }

  function navigate(delta: number) {
    navigatedRef.current = true;
    setOverlay({});
    setDate((d) => addDays(d, delta));
  }
  function goToday() {
    navigatedRef.current = false;
    setOverlay({});
    setDate(today);
  }

  const refillCount = refills.data?.length ?? 0;

  return (
    <Screen
      title={t("today.title")}
      subtitle={formatDate(date, locale)}
      right={
        <View style={styles.headerRight}>
          <AccountMenu />
          <Pressable onPress={() => router.push("/scan")} hitSlop={8}>
            <Ionicons name="qr-code-outline" size={22} color={colors.text} />
          </Pressable>
          <BarnSwitcher />
        </View>
      }
    >
      {/* date nav */}
      <View style={styles.dateNav}>
        <Pressable onPress={() => navigate(-1)} hitSlop={8} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        {!isToday ? (
          <Pressable onPress={goToday} style={styles.todayPill}>
            <Text style={styles.todayPillText}>{t("today.title")}</Text>
          </Pressable>
        ) : (
          <Text style={styles.dateLabel}>{formatDate(date, locale)}</Text>
        )}
        <Pressable onPress={() => navigate(1)} hitSlop={8} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </Pressable>
      </View>

      {/* progress */}
      <View style={styles.progressWrap}>
        <Text style={styles.progressText}>
          {t("today.tasksCompleted", { done, total })}
        </Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: total > 0 ? `${(done / total) * 100}%` : "0%" },
            ]}
          />
        </View>
      </View>

      {/* low feed banner — avoids ICU plurals (unsupported by Hermes here) */}
      {refillCount > 0 && refills.data?.[0] ? (
        <Pressable onPress={() => router.push("/(tabs)/prep")} style={styles.feedBanner}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.warnText} />
          <Text style={styles.feedBannerText}>
            {refills.data[0].feedType} —{" "}
            {t("today.feedDaysLeft", { days: Math.round(refills.data[0].daysLeft ?? 0) })}
            {refillCount > 1 ? ` (+${refillCount - 1})` : ""}
          </Text>
        </Pressable>
      ) : null}

      {/* slot filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.slotRow}
      >
        {SLOTS.map((s) => (
          <Pressable
            key={s}
            onPress={() => setSlot(s)}
            style={[styles.slotChip, slot === s && styles.slotChipActive]}
          >
            <Text style={[styles.slotChipText, slot === s && styles.slotChipTextActive]}>
              {t(`today.slots.${s}`)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {groupsQuery.isLoading ? (
        <Loading />
      ) : groupsQuery.error ? (
        <ErrorNote message={groupsQuery.error.message} />
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {(() => {
            const visibleGroups = groups
              .map((g) => ({
                ...g,
                tasks: g.tasks.filter((task) => slot === "ALL" || task.slot === slot),
              }))
              .filter((g) => g.tasks.length > 0);

            if (visibleGroups.length === 0) {
              return <EmptyState text={t("today.noTasks")} />;
            }

            return visibleGroups.map((g) => (
              <View key={g.id} style={styles.group}>
                <Text style={styles.groupTitle}>
                  {g.buildingName ? `${g.buildingName} · ` : ""}
                  {g.name}
                </Text>
                {g.tasks.map((task) => {
                  const done = isDone(task);
                  const skipped = effStatus(task) === "skipped";
                  return (
                    <Card key={`${task.taskType}-${task.id}`} style={styles.taskCard}>
                      <Pressable
                        style={styles.checkArea}
                        onPress={() => toggle(task)}
                        disabled={skipped}
                      >
                        <Ionicons
                          name={
                            done
                              ? "checkmark-circle"
                              : skipped
                                ? "close-circle"
                                : "ellipse-outline"
                          }
                          size={26}
                          color={done ? colors.success : skipped ? colors.muted : colors.border}
                        />
                        <View style={styles.taskBody}>
                          <View style={styles.taskTopRow}>
                            <Badge
                              label={t(`today.taskTypes.${task.taskType}`)}
                              color={taskColors[task.taskType] ?? colors.muted}
                            />
                            {task.animalName ? (
                              <Text style={styles.animalName}>{task.animalName}</Text>
                            ) : null}
                          </View>
                          <Text
                            style={[styles.taskLabel, (done || skipped) && styles.taskLabelDone]}
                          >
                            {task.label}
                          </Text>
                          {task.detail ? (
                            <Text style={styles.taskDetail}>{task.detail}</Text>
                          ) : null}
                        </View>
                      </Pressable>
                      {!done && !skipped ? (
                        <Pressable onPress={() => onSkip(task)} hitSlop={6} style={styles.skipBtn}>
                          <Text style={styles.skipText}>{t("today.skipped")}</Text>
                        </Pressable>
                      ) : null}
                    </Card>
                  );
                })}
              </View>
            ));
          })()}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  dateNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingBottom: 10,
  },
  navBtn: { padding: 4 },
  dateLabel: { fontSize: 15, fontWeight: "600", color: colors.text, minWidth: 140, textAlign: "center" },
  todayPill: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 6,
    minWidth: 140,
    alignItems: "center",
  },
  todayPillText: { color: colors.primaryText, fontWeight: "700" },
  progressWrap: { paddingHorizontal: 16, gap: 6, paddingBottom: 10 },
  progressText: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  progressTrack: { height: 8, backgroundColor: colors.border, borderRadius: 999, overflow: "hidden" },
  progressFill: { height: 8, backgroundColor: colors.success },
  feedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.warnBg,
    borderWidth: 1,
    borderColor: colors.warnBorder,
  },
  feedBannerText: { color: colors.warnText, flexShrink: 1, fontWeight: "600" },
  slotRow: { gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  slotChip: {
    paddingHorizontal: 14,
    height: 34,
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  slotChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  slotChipText: { color: colors.text, fontWeight: "600" },
  slotChipTextActive: { color: colors.primaryText },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  group: { marginBottom: 18, gap: 8 },
  groupTitle: { fontSize: 13, fontWeight: "700", color: colors.muted, textTransform: "uppercase" },
  taskCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  checkArea: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1, flexGrow: 1 },
  taskBody: { flexShrink: 1, gap: 4 },
  taskTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  animalName: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  taskLabel: { fontSize: 15, fontWeight: "600", color: colors.text },
  taskLabelDone: { textDecorationLine: "line-through", color: colors.muted },
  taskDetail: { fontSize: 13, color: colors.muted },
  skipBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  skipText: { color: colors.muted, fontSize: 12, fontWeight: "600" },
});
