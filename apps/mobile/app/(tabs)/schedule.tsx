import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Screen } from "../../components/Screen";
import { BarnSwitcher } from "../../components/BarnSwitcher";
import { Card, EmptyState, ErrorNote, Loading } from "../../components/ui";
import { useBarn } from "../../lib/barn";
import { trpc } from "../../lib/trpc";
import { colors } from "../../lib/theme";

const DAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; // ISO 1..7

function formatRepeatDays(days: number[]): string {
  if (days.length === 7) return "Daily";
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => DAY_ABBR[d - 1])
    .join(", ");
}

export default function ScheduleScreen() {
  const { t } = useTranslation();
  const { barnId } = useBarn();
  const q = trpc.scheduledEvent.list.useQuery(
    { barnId: barnId ?? "" },
    { enabled: !!barnId },
  );

  return (
    <Screen title={t("nav.schedule")} right={<BarnSwitcher />}>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorNote message={q.error.message} />
      ) : (q.data?.length ?? 0) === 0 ? (
        <EmptyState text={t("today.noTasks")} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {q.data!.map((ev) => (
            <Card key={ev.id} style={styles.row}>
              <View style={styles.iconWrap}>
                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.body}>
                <Text style={styles.title}>{ev.title}</Text>
                <Text style={styles.meta}>
                  {ev.startTime}
                  {ev.endTime ? `–${ev.endTime}` : ""} · {formatRepeatDays(ev.repeatDays)}
                </Text>
                {ev.notes ? <Text style={styles.notes}>{ev.notes}</Text> : null}
              </View>
            </Card>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flexShrink: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: "700", color: colors.text },
  meta: { fontSize: 13, color: colors.muted },
  notes: { fontSize: 13, color: colors.muted, fontStyle: "italic" },
});
