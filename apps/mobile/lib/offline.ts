import { QueryClient, onlineManager, focusManager } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { AppState, type AppStateStatus } from "react-native";

// Bridge React Query's connectivity signal to NetInfo so queries/mutations pause
// offline and resume on reconnect.
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(Boolean(state.isConnected));
  });
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Serve cached data first so the app works offline; refetch when possible.
      networkMode: "offlineFirst",
      staleTime: 1000 * 30,
      gcTime: 1000 * 60 * 60 * 24, // retain 24h for offline reads
      retry: 2,
    },
    mutations: {
      // Queue writes while offline; they flush on reconnect (see resumePausedMutations).
      networkMode: "offlineFirst",
      retry: 0,
    },
  },
});

// Persists the query cache AND paused mutations to AsyncStorage so a queued
// completion/note survives an app restart while offline.
export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  throttleTime: 1000,
});

export function subscribeAppState(): () => void {
  const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
    focusManager.setFocused(state === "active");
  });
  return () => sub.remove();
}
