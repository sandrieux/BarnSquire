import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Screen } from "../../components/Screen";
import { BarnSwitcher } from "../../components/BarnSwitcher";
import { EmptyState, ErrorNote, Loading } from "../../components/ui";
import { useBarn } from "../../lib/barn";
import { trpc } from "../../lib/trpc";
import { colors } from "../../lib/theme";

export default function AnimalsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { barnId } = useBarn();
  const [search, setSearch] = useState("");

  // A scanned stall/pasture tag routes here with a location id to filter by.
  // Empty string → undefined so the cuid-validated tRPC input isn't sent "".
  const params = useLocalSearchParams<{ stallId?: string; pastureId?: string }>();
  const stallId = params.stallId || undefined;
  const pastureId = params.pastureId || undefined;
  const locationFilter = stallId ?? pastureId ?? null;

  const q = trpc.animal.list.useQuery(
    { barnId: barnId ?? "", stallId, pastureId },
    { enabled: !!barnId },
  );

  const animals = useMemo(() => {
    const list = q.data ?? [];
    const s = search.trim().toLowerCase();
    return s ? list.filter((a) => a.name.toLowerCase().includes(s)) : list;
  }, [q.data, search]);

  return (
    <Screen title={t("nav.animals")} right={<BarnSwitcher />}>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder={t("nav.animals")}
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
      </View>

      {locationFilter ? (
        <Pressable
          style={styles.filterChip}
          onPress={() => router.setParams({ stallId: "", pastureId: "" })}
        >
          <Ionicons name="location" size={14} color={colors.text} />
          <Text style={styles.filterText}>
            {q.data?.[0]?.homeStall?.name ?? q.data?.[0]?.homePasture?.name ?? t("animals.filteredByLocation")}
          </Text>
          <Ionicons name="close-circle" size={16} color={colors.muted} />
        </Pressable>
      ) : null}

      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorNote message={q.error.message} />
      ) : animals.length === 0 ? (
        <EmptyState text={t("owner.noAnimals")} />
      ) : (
        <FlatList
          data={animals}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const location = item.homeStall?.name ?? item.homePasture?.name ?? null;
            const subtitle = [item.species, item.breed].filter(Boolean).join(" · ");
            return (
              <Pressable style={styles.row} onPress={() => router.push(`/animal/${item.id}`)}>
                {item.profilePhotoUrl ? (
                  <Image source={{ uri: item.profilePhotoUrl }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Ionicons name="paw" size={20} color={colors.muted} />
                  </View>
                )}
                <View style={styles.body}>
                  <Text style={styles.name}>{item.name}</Text>
                  {subtitle ? <Text style={styles.meta}>{subtitle}</Text> : null}
                  {location ? <Text style={styles.location}>{location}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.text },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
  },
  filterText: { fontSize: 13, fontWeight: "600", color: colors.text },
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.border },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  body: { flexShrink: 1, flexGrow: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: "700", color: colors.text },
  meta: { fontSize: 13, color: colors.muted },
  location: { fontSize: 12, color: colors.muted },
});
