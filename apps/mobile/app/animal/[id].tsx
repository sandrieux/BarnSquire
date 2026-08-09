import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { AppButton, Badge, EmptyState, ErrorNote, Loading } from "../../components/ui";
import { trpc } from "../../lib/trpc";
import { uploadToPresignedUrl } from "../../lib/api";
import {
  pickPhotoFromCamera,
  pickPhotoFromLibrary,
  scanDocument,
  type PendingAttachment,
} from "../../lib/attachments";
import { formatDate } from "../../lib/dates";
import { colors } from "../../lib/theme";
import { GrowthChart } from "../../components/GrowthChart";
import {
  HEIGHT_UNITS,
  WEIGHT_UNITS,
  type HeightUnit,
  type LedgerCategory,
  type WeightUnit,
} from "@barnsquire/validators";

type Category = LedgerCategory;
const CATEGORIES: Category[] = ["ACTIVITY", "MEDICATION", "FEEDING", "MEASUREMENT", "OTHER"];
// Badge appends "22" for its fill, so these must stay 6-digit hex.
const CATEGORY_COLOR: Record<Category, string> = {
  FEEDING: "#16a34a",
  MEDICATION: "#ea580c",
  ACTIVITY: "#2563eb",
  MEASUREMENT: "#0891b2",
  OTHER: "#475569",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function AnimalLedgerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const animalId = id ?? "";
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const utils = trpc.useUtils();

  const animal = trpc.animal.get.useQuery({ id: animalId }, { enabled: !!animalId });
  const entries = trpc.ledger.getEntries.useQuery({ animalId }, { enabled: !!animalId });
  const [showForm, setShowForm] = useState(false);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: animal.data?.name ?? t("nav.animals") }} />

      {entries.isLoading ? (
        <Loading />
      ) : entries.error ? (
        <ErrorNote message={entries.error.message} />
      ) : (
        <FlatList
          data={entries.data ?? []}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<GrowthChart animalId={animalId} />}
          ListEmptyComponent={<EmptyState text={t("today.noTasks")} />}
          renderItem={({ item }) => (
            <View style={styles.entry}>
              <View style={styles.entryHeader}>
                <Badge label={item.category} color={CATEGORY_COLOR[item.category as Category] ?? colors.muted} />
                <Text style={styles.entryDate}>{formatDate(item.date, locale)}</Text>
              </View>
              <Text style={styles.entryTitle}>{item.title}</Text>
              {item.detail ? <Text style={styles.entryDetail}>{item.detail}</Text> : null}
              {item.notes ? <Text style={styles.entryNotes}>{item.notes}</Text> : null}
              {item.status ? (
                <Text style={styles.entryStatus}>
                  {item.status === "skipped" ? t("today.detail.skipped") : t("today.detail.notDone")}
                </Text>
              ) : null}
              {item.attachments.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.attachRow}>
                  {item.attachments.map((a) => (
                    <Pressable key={a.id} onPress={() => Linking.openURL(a.url)}>
                      {a.mimeType.startsWith("image/") ? (
                        <Image source={{ uri: a.url }} style={styles.attachThumb} contentFit="cover" />
                      ) : (
                        <View style={[styles.attachThumb, styles.pdfThumb]}>
                          <Ionicons name="document-text-outline" size={26} color={colors.danger} />
                          <Text style={styles.pdfLabel}>PDF</Text>
                        </View>
                      )}
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}
            </View>
          )}
        />
      )}

      <Pressable style={styles.fab} onPress={() => setShowForm(true)}>
        <Ionicons name="add" size={28} color={colors.primaryText} />
      </Pressable>

      <AddEntryModal
        visible={showForm}
        animalId={animalId}
        onClose={() => setShowForm(false)}
        onSaved={() => {
          setShowForm(false);
          void utils.ledger.getEntries.invalidate({ animalId });
        }}
      />
    </View>
  );
}

function AddEntryModal({
  visible,
  animalId,
  onClose,
  onSaved,
}: {
  visible: boolean;
  animalId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<Category>("ACTIVITY");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [occurredAt, setOccurredAt] = useState(todayStr());
  const [weight, setWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("LB");
  const [height, setHeight] = useState("");
  const [heightUnit, setHeightUnit] = useState<HeightUnit>("HANDS");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMeasurement = category === "MEASUREMENT";

  const getUploadUrl = trpc.ledger.getUploadUrl.useMutation();
  const createEntry = trpc.ledger.createEntry.useMutation();

  function reset() {
    setCategory("ACTIVITY");
    setTitle("");
    setNotes("");
    setOccurredAt(todayStr());
    setWeight("");
    setHeight("");
    setPending([]);
    setError(null);
  }

  async function addFrom(source: "camera" | "library" | "scan") {
    try {
      if (source === "scan") {
        const scans = await scanDocument();
        setPending((p) => [...p, ...scans].slice(0, 10));
      } else {
        const pick = source === "camera" ? await pickPhotoFromCamera() : await pickPhotoFromLibrary();
        if (pick) setPending((p) => [...p, pick].slice(0, 10));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add attachment");
    }
  }

  async function submit() {
    // Measurements default their title so the number is the only required input.
    const entryTitle = title.trim() || (isMeasurement ? t("ledger.measurement") : "");
    if (!entryTitle) {
      setError(t("auth.registrationFailed"));
      return;
    }
    if (!DATE_RE.test(occurredAt)) {
      setError(t("ledger.invalidDate"));
      return;
    }
    if (isMeasurement && !weight.trim() && !height.trim()) {
      setError(t("ledger.needsOneMeasurement"));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const uploaded: Array<{
        storageKey: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number;
      }> = [];
      for (const att of pending) {
        const { uploadUrl, storageKey } = await getUploadUrl.mutateAsync({
          animalId,
          fileName: att.fileName,
          mimeType: att.mimeType,
        });
        await uploadToPresignedUrl(uploadUrl, att.uri, att.mimeType);
        uploaded.push({
          storageKey,
          fileName: att.fileName,
          mimeType: att.mimeType,
          sizeBytes: att.sizeBytes,
        });
      }
      const [y, m, d] = occurredAt.split("-").map(Number);
      await createEntry.mutateAsync({
        animalId,
        category,
        title: entryTitle,
        notes: notes.trim() || undefined,
        // Local midnight, not `new Date("YYYY-MM-DD")` which is UTC and can
        // land a day early (the gotcha documented in CLAUDE.md).
        occurredAt: new Date(y!, m! - 1, d!),
        weight:
          isMeasurement && weight.trim()
            ? { value: Number(weight), unit: weightUnit }
            : undefined,
        height:
          isMeasurement && height.trim()
            ? { value: Number(height), unit: heightUnit }
            : undefined,
        attachments: uploaded,
      });
      reset();
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={styles.modal} contentContainerStyle={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t("today.viewDetails")}</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
        </View>

        {error ? <ErrorNote message={error} /> : null}

        <Text style={styles.label}>{t("today.detail.task")}</Text>
        <View style={styles.catRow}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              onPress={() => setCategory(c)}
              style={[styles.catChip, category === c && { backgroundColor: CATEGORY_COLOR[c], borderColor: CATEGORY_COLOR[c] }]}
            >
              <Text style={[styles.catText, category === c && { color: colors.primaryText }]}>{c}</Text>
            </Pressable>
          ))}
        </View>

        {/* Date is editable rather than pinned to now: measurements are often
            entered after the fact. A plain text field avoids the native
            datetimepicker, which would break the OTA-only update path. */}
        <Text style={styles.label}>{t("ledger.date")}</Text>
        <TextInput
          style={styles.input}
          value={occurredAt}
          onChangeText={setOccurredAt}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {isMeasurement ? (
          <>
            <Text style={styles.label}>{t("ledger.weight")}</Text>
            <View style={styles.measureRow}>
              <TextInput
                style={[styles.input, styles.measureInput]}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.muted}
              />
              <View style={styles.unitRow}>
                {WEIGHT_UNITS.map((u) => (
                  <Pressable
                    key={u}
                    onPress={() => setWeightUnit(u)}
                    style={[styles.unitChip, weightUnit === u && styles.unitChipOn]}
                  >
                    <Text style={[styles.unitText, weightUnit === u && styles.unitTextOn]}>
                      {t(`ledger.units.${u}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Text style={styles.label}>{t("ledger.height")}</Text>
            <View style={styles.measureRow}>
              <TextInput
                style={[styles.input, styles.measureInput]}
                value={height}
                onChangeText={setHeight}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.muted}
              />
              <View style={styles.unitRow}>
                {HEIGHT_UNITS.map((u) => (
                  <Pressable
                    key={u}
                    onPress={() => setHeightUnit(u)}
                    style={[styles.unitChip, heightUnit === u && styles.unitChipOn]}
                  >
                    <Text style={[styles.unitText, heightUnit === u && styles.unitTextOn]}>
                      {t(`ledger.units.${u}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            {heightUnit === "HANDS" ? (
              <Text style={styles.hint}>{t("ledger.handsHint")}</Text>
            ) : null}
          </>
        ) : null}

        <Text style={styles.label}>{t("today.detail.details")}</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder={isMeasurement ? t("ledger.measurement") : "Title"}
          placeholderTextColor={colors.muted}
        />

        <Text style={styles.label}>{t("today.detail.notes")}</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="…"
          placeholderTextColor={colors.muted}
        />

        <Text style={styles.label}>{t("today.detail.notes")}</Text>
        <View style={styles.attachActions}>
          <AttachButton icon="camera-outline" label="Photo" onPress={() => addFrom("camera")} />
          <AttachButton icon="images-outline" label="Library" onPress={() => addFrom("library")} />
          <AttachButton icon="scan-outline" label="Scan" onPress={() => addFrom("scan")} />
        </View>

        {pending.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.attachRow}>
            {pending.map((att, i) => (
              <View key={`${att.uri}-${i}`} style={styles.pendingWrap}>
                <Image source={{ uri: att.uri }} style={styles.attachThumb} contentFit="cover" />
                <Pressable
                  style={styles.removeBadge}
                  onPress={() => setPending((p) => p.filter((_, idx) => idx !== i))}
                >
                  <Ionicons name="close-circle" size={20} color={colors.danger} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}

        <View style={{ height: 12 }} />
        <AppButton title={t("settings.save")} onPress={submit} loading={saving} />
      </ScrollView>
    </Modal>
  );
}

function AttachButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.attachBtn} onPress={onPress}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <Text style={styles.attachBtnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: 16, gap: 12, paddingBottom: 96 },
  entry: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  entryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  entryDate: { fontSize: 12, color: colors.muted },
  entryTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  entryDetail: { fontSize: 13, color: colors.muted },
  entryNotes: { fontSize: 14, color: colors.text },
  entryStatus: { fontSize: 12, color: colors.muted, fontStyle: "italic" },
  attachRow: { marginTop: 6 },
  attachThumb: { width: 72, height: 72, borderRadius: 8, marginRight: 8, backgroundColor: colors.border },
  pdfThumb: { alignItems: "center", justifyContent: "center", backgroundColor: "#fef2f2" },
  pdfLabel: { fontSize: 10, color: colors.danger, fontWeight: "700" },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  modal: { flex: 1, backgroundColor: colors.bg },
  modalContent: { padding: 20, gap: 8 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
  label: { fontSize: 13, fontWeight: "700", color: colors.muted, marginTop: 8 },
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: {
    paddingHorizontal: 14,
    height: 36,
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  catText: { fontWeight: "700", color: colors.text, fontSize: 13 },
  measureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  measureInput: { flex: 1 },
  unitRow: { flexDirection: "row", gap: 6 },
  unitChip: {
    paddingHorizontal: 12,
    height: 40,
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  unitChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  unitText: { fontWeight: "700", color: colors.text, fontSize: 13 },
  unitTextOn: { color: colors.primaryText },
  hint: { fontSize: 12, color: colors.muted },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    minHeight: 48,
    fontSize: 16,
    color: colors.text,
  },
  textarea: { minHeight: 90, paddingTop: 12, textAlignVertical: "top" },
  attachActions: { flexDirection: "row", gap: 10 },
  attachBtn: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  attachBtnText: { fontSize: 12, fontWeight: "600", color: colors.primary },
  pendingWrap: { position: "relative" },
  removeBadge: { position: "absolute", top: -6, right: 2, backgroundColor: colors.card, borderRadius: 999 },
});
