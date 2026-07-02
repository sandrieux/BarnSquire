import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../lib/auth";
import { AppButton, ErrorNote } from "../../components/ui";
import { colors } from "../../lib/theme";

export default function LoginScreen() {
  const { login, apiUrl, setApiUrl } = useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [server, setServer] = useState(apiUrl);

  // Reflect the persisted base once it loads.
  useEffect(() => setServer(apiUrl), [apiUrl]);

  async function onSubmit() {
    if (!email.trim() || password.length < 8) {
      setError(t("auth.invalidCredentials"));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const trimmed = server.trim();
      if (trimmed && trimmed !== apiUrl) await setApiUrl(trimmed);
      await login(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("auth.invalidCredentials"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <View style={styles.inner}>
        <Text style={styles.brand}>BarnSquire</Text>

        {error ? <ErrorNote message={error} /> : null}

        <View style={styles.field}>
          <Text style={styles.label}>{t("auth.email")}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="you@barn.com"
            placeholderTextColor={colors.muted}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t("auth.password")}</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            placeholder="••••••••"
            placeholderTextColor={colors.muted}
          />
        </View>

        <AppButton
          title={loading ? t("auth.signingIn") : t("auth.signIn")}
          onPress={onSubmit}
          loading={loading}
        />

        <Pressable onPress={() => setShowAdvanced((s) => !s)} hitSlop={8} style={styles.advancedToggle}>
          <Text style={styles.advancedToggleText}>
            {showAdvanced ? "▾" : "▸"} Server
          </Text>
        </Pressable>
        {showAdvanced ? (
          <View style={styles.field}>
            <TextInput
              style={styles.input}
              value={server}
              onChangeText={setServer}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="https://barnsquire.example.com"
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.hint}>
              The BarnSquire instance to connect to. Change this only to use a different server.
            </Text>
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, justifyContent: "center", padding: 24, gap: 16 },
  brand: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.primary,
    textAlign: "center",
    marginBottom: 8,
  },
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
  advancedToggle: { alignSelf: "center", paddingVertical: 4 },
  advancedToggleText: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  hint: { fontSize: 12, color: colors.muted },
});
