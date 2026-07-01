import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useBarn } from "../lib/barn";
import { colors } from "../lib/theme";

export function BarnSwitcher() {
  const { barn, barns, setBarnId } = useBarn();
  const [open, setOpen] = useState(false);
  if (!barn) return null;
  const multiple = barns.length > 1;

  return (
    <>
      <Pressable
        style={styles.trigger}
        onPress={() => multiple && setOpen(true)}
        hitSlop={8}
      >
        <Ionicons name="business-outline" size={16} color={colors.muted} />
        <Text style={styles.name} numberOfLines={1}>
          {barn.name}
        </Text>
        {multiple ? <Ionicons name="chevron-down" size={16} color={colors.muted} /> : null}
      </Pressable>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            {barns.map((b) => (
              <Pressable
                key={b.id}
                style={styles.item}
                onPress={() => {
                  setBarnId(b.id);
                  setOpen(false);
                }}
              >
                <Text
                  style={[styles.itemText, b.id === barn.id && styles.itemActive]}
                  numberOfLines={1}
                >
                  {b.name}
                </Text>
                {b.id === barn.id ? (
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: 180,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.card,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { color: colors.text, fontWeight: "600", flexShrink: 1 },
  backdrop: { flex: 1, backgroundColor: "#00000055", justifyContent: "center", padding: 32 },
  sheet: { backgroundColor: colors.card, borderRadius: 14, overflow: "hidden" },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemText: { fontSize: 16, color: colors.text, flexShrink: 1 },
  itemActive: { color: colors.primary, fontWeight: "700" },
});
