import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/auth";
import { trpc } from "../lib/trpc";
import { AppButton, ErrorNote } from "../components/ui";
import { colors } from "../lib/theme";

export default function ChangePasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, setUser, logout } = useAuth();
  const forced = Boolean(user?.mustChangePassword);
  const [currentPw, setCurrentPw] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const changePassword = trpc.user.changePassword.useMutation();

  async function onSubmit() {
    if (pw.length < 8) {
      setError(t("auth.passwordTooShort"));
      return;
    }
    if (pw !== confirm) {
      setError(t("auth.passwordsNoMatch"));
      return;
    }
    // Self-service changes must re-authenticate; the forced first-login flow does not.
    if (!forced && !currentPw) {
      setError(t("auth.currentPasswordRequired"));
      return;
    }
    setError(null);
    try {
      await changePassword.mutateAsync({
        newPassword: pw,
        currentPassword: forced ? undefined : currentPw,
      });
      // Clearing the flag lets the auth gate route on to the app.
      if (user) setUser({ ...user, mustChangePassword: false });
      router.replace("/(tabs)");
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("auth.registrationFailed");
      setError(msg === "CURRENT_PASSWORD_INVALID" ? t("auth.currentPasswordWrong") : msg);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("auth.setNewPasswordTitle")}</Text>
      <Text style={styles.muted}>{t("auth.setNewPasswordDesc")}</Text>

      {error ? <ErrorNote message={error} /> : null}

      {!forced ? (
        <View style={styles.field}>
          <Text style={styles.label}>{t("auth.currentPassword")}</Text>
          <TextInput
            style={styles.input}
            value={currentPw}
            onChangeText={setCurrentPw}
            secureTextEntry
            placeholderTextColor={colors.muted}
          />
        </View>
      ) : null}

      <View style={styles.field}>
        <Text style={styles.label}>{t("auth.newPassword")}</Text>
        <TextInput
          style={styles.input}
          value={pw}
          onChangeText={setPw}
          secureTextEntry
          placeholder={t("auth.minChars")}
          placeholderTextColor={colors.muted}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{t("auth.confirmNewPassword")}</Text>
        <TextInput
          style={styles.input}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          placeholderTextColor={colors.muted}
        />
      </View>

      <AppButton
        title={t("auth.setPassword")}
        onPress={onSubmit}
        loading={changePassword.isPending}
      />
      <AppButton title={t("topnav.signOut")} variant="outline" onPress={() => void logout()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 24, gap: 14, justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700", color: colors.text },
  muted: { color: colors.muted, marginBottom: 8 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600", color: colors.muted },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 16,
    color: colors.text,
  },
});
