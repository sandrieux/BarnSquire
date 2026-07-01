import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAuth } from "../lib/auth";
import { AppButton } from "../components/ui";
import { colors } from "../lib/theme";

export default function LockScreen() {
  const { unlock, logout } = useAuth();

  // Prompt for biometrics automatically on mount.
  useEffect(() => {
    void unlock();
  }, [unlock]);

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>BarnSquire</Text>
      <Text style={styles.muted}>Locked</Text>
      <View style={styles.actions}>
        <AppButton title="Unlock" onPress={() => void unlock()} />
        <AppButton title="Sign out" variant="outline" onPress={() => void logout()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 24,
  },
  brand: { fontSize: 28, fontWeight: "800", color: colors.primary },
  muted: { color: colors.muted, marginBottom: 24 },
  actions: { alignSelf: "stretch", gap: 12 },
});
