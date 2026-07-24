import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  apiUrl?: string;
  eas?: { projectId?: string };
};

// Base URL of the BarnSquire web/API deployment (baked into extra.apiUrl by
// app.config.ts from EXPO_PUBLIC_API_URL). The fallback mirrors app.config.ts's
// production default so a missing manifest value never points the app at
// localhost (see the OTA-footgun note there).
export const API_URL: string = extra.apiUrl ?? "https://barnsquire.lysranch.com";
export const TRPC_URL = `${API_URL}/api/trpc`;
export const EAS_PROJECT_ID: string | undefined = extra.eas?.projectId;
