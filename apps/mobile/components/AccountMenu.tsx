import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/auth";
import { colors } from "../lib/theme";

export function AccountMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={8}>
        <Ionicons name="person-circle-outline" size={24} color={colors.text} />
      </Pressable>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.name} numberOfLines={1}>
              {user?.name ?? user?.email ?? ""}
            </Text>
            {user?.email ? (
              <Text style={styles.email} numberOfLines={1}>
                {user.email}
              </Text>
            ) : null}

            <View style={styles.divider} />

            <Pressable
              style={styles.item}
              onPress={() => {
                setOpen(false);
                router.push("/change-password");
              }}
            >
              <Ionicons name="key-outline" size={18} color={colors.text} />
              <Text style={styles.itemText}>{t("topnav.changePassword")}</Text>
            </Pressable>

            <Pressable
              style={styles.item}
              onPress={() => {
                setOpen(false);
                void logout();
              }}
            >
              <Ionicons name="log-out-outline" size={18} color={colors.danger} />
              <Text style={[styles.itemText, { color: colors.danger }]}>{t("topnav.signOut")}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "#00000055", justifyContent: "center", padding: 32 },
  sheet: { backgroundColor: colors.card, borderRadius: 14, padding: 8, overflow: "hidden" },
  name: { fontSize: 16, fontWeight: "700", color: colors.text, paddingHorizontal: 12, paddingTop: 8 },
  email: { fontSize: 13, color: colors.muted, paddingHorizontal: 12, paddingBottom: 8 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 4 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 14 },
  itemText: { fontSize: 16, color: colors.text },
});
