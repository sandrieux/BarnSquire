import * as SecureStore from "expo-secure-store";
import type { MobileUser } from "./api";

// Secure, persistent storage for the access/refresh tokens and cached user.
// The access token is also held in memory for synchronous reads on each request.

const ACCESS_KEY = "bs_access_token";
const REFRESH_KEY = "bs_refresh_token";
const USER_KEY = "bs_user";

let accessTokenCache: string | null = null;

export async function loadSession(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
  user: MobileUser | null;
}> {
  const [accessToken, refreshToken, userJson] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
    SecureStore.getItemAsync(USER_KEY),
  ]);
  accessTokenCache = accessToken;
  let user: MobileUser | null = null;
  try {
    user = userJson ? (JSON.parse(userJson) as MobileUser) : null;
  } catch {
    user = null;
  }
  return { accessToken, refreshToken, user };
}

export function getAccessTokenSync(): string | null {
  return accessTokenCache;
}

export function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function setSession(
  accessToken: string,
  refreshToken: string,
  user: MobileUser,
): Promise<void> {
  accessTokenCache = accessToken;
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, refreshToken),
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
  ]);
}

export async function setAccessToken(accessToken: string): Promise<void> {
  accessTokenCache = accessToken;
  await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
}

export async function clearSession(): Promise<void> {
  accessTokenCache = null;
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
}
