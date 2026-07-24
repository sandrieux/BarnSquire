import React, { useEffect, useMemo, useRef, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { I18nextProvider } from "react-i18next";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../lib/auth";
import { BarnProvider } from "../lib/barn";
import { trpc, createTrpcClient } from "../lib/trpc";
import { queryClient, asyncStoragePersister, subscribeAppState } from "../lib/offline";
import { initI18n } from "../lib/i18n";
import { Loading } from "../components/ui";
import { PushRegistrar } from "../components/PushRegistrar";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppProviders />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function AppProviders() {
  const { user, apiUrl } = useAuth();
  // Recreate the tRPC client when the instance URL changes (baked httpBatchLink url).
  const trpcClient = useMemo(() => createTrpcClient(), [apiUrl]);
  const [i18n] = useState(() => initI18n(user?.locale));

  // Drop cached data when switching instances (skip the initial mount).
  const firstApiUrl = useRef(true);
  useEffect(() => {
    if (firstApiUrl.current) {
      firstApiUrl.current = false;
      return;
    }
    queryClient.clear();
  }, [apiUrl]);

  useEffect(() => subscribeAppState(), []);
  useEffect(() => {
    initI18n(user?.locale);
  }, [user?.locale]);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: asyncStoragePersister }}
      onSuccess={() => {
        // Flush completions/notes that were queued while offline.
        void queryClient.resumePausedMutations();
      }}
    >
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <I18nextProvider i18n={i18n}>
          <BarnProvider>
            <StatusBar style="dark" />
            <PushRegistrar />
            <RootNavigator />
          </BarnProvider>
        </I18nextProvider>
      </trpc.Provider>
    </PersistQueryClientProvider>
  );
}

function RootNavigator() {
  const { status, user } = useAuth();
  useAuthGate(status, user?.mustChangePassword ?? false);

  if (status === "loading") return <Loading />;

  return (
    // headerBackButtonDisplayMode "minimal" shows just the chevron on pushed
    // screens; otherwise iOS labels the back button with the previous route's
    // title, which for the tab group is the bare route name "(tabs)".
    <Stack screenOptions={{ headerShown: false, headerBackButtonDisplayMode: "minimal" }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="lock" />
      <Stack.Screen name="animal/[id]" options={{ headerShown: true, title: "Ledger" }} />
      <Stack.Screen
        name="scan"
        options={{ presentation: "modal", headerShown: true, title: "Scan" }}
      />
      <Stack.Screen
        name="change-password"
        options={{ headerShown: true, title: "Change password" }}
      />
    </Stack>
  );
}

// Canonical Expo Router auth gate: redirect based on auth status + current group.
function useAuthGate(status: string, mustChangePassword: boolean) {
  const segments = useSegments();
  const router = useRouter();
  useEffect(() => {
    if (status === "loading") return;
    const root = segments[0];
    if (status === "signedOut" && root !== "(auth)") {
      router.replace("/(auth)/login");
    } else if (status === "locked" && root !== "lock") {
      router.replace("/lock");
    } else if (status === "signedIn") {
      if (mustChangePassword && root !== "change-password") {
        router.replace("/change-password");
      } else if (!mustChangePassword && (root === "(auth)" || root === "lock")) {
        router.replace("/(tabs)");
      }
    }
  }, [status, mustChangePassword, segments, router]);
}
