import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL as DEFAULT_API_URL } from "./config";

// The API base URL is normally baked in via EXPO_PUBLIC_API_URL, but can be
// overridden at runtime (login screen) and persisted, so one build can point at
// different BarnSquire instances without rebuilding.
const KEY = "bs_api_url";
let current = DEFAULT_API_URL;

export { DEFAULT_API_URL };

export function getApiUrl(): string {
  return current;
}

export function getTrpcUrl(): string {
  return `${current}/api/trpc`;
}

export async function loadApiBase(): Promise<string> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v) current = v;
  } catch {
    // fall back to the baked-in default
  }
  return current;
}

export async function setApiBase(url: string): Promise<void> {
  current = url.trim().replace(/\/+$/, "");
  await AsyncStorage.setItem(KEY, current);
}

export async function resetApiBase(): Promise<void> {
  current = DEFAULT_API_URL;
  await AsyncStorage.removeItem(KEY);
}
