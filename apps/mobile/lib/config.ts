import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  apiUrl?: string;
  eas?: { projectId?: string };
};

// Base URL of the BarnSquire web/API deployment (set via EXPO_PUBLIC_API_URL).
export const API_URL: string = extra.apiUrl ?? "http://localhost:3000";
export const TRPC_URL = `${API_URL}/api/trpc`;
export const EAS_PROJECT_ID: string | undefined = extra.eas?.projectId;
