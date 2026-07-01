import * as FileSystem from "expo-file-system";
import { API_URL } from "./config";
import {
  getAccessTokenSync,
  getRefreshToken,
  setAccessToken,
  clearSession,
} from "./tokenStore";

export interface MobileUser {
  id: string;
  name: string | null;
  email: string | null;
  mustChangePassword: boolean;
  locale: string | null;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: MobileUser;
}

// --- REST auth endpoints (outside tRPC) ---------------------------------------

export async function loginRequest(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/api/mobile/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Login failed");
  }
  return (await res.json()) as LoginResponse;
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;
  const res = await fetch(`${API_URL}/api/mobile/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return null;
  const { accessToken } = (await res.json()) as { accessToken?: string };
  if (accessToken) {
    await setAccessToken(accessToken);
    return accessToken;
  }
  return null;
}

// --- Authed fetch used by the tRPC client -------------------------------------
// Injects the bearer token and, on a 401, refreshes once and retries. If refresh
// fails, the session is cleared (the AuthProvider observes this on next request).

export const authedFetch: typeof fetch = async (input, init) => {
  const withAuth = (token: string | null): RequestInit => ({
    ...init,
    headers: {
      ...(init?.headers as Record<string, string> | undefined),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  let res = await fetch(input as RequestInfo, withAuth(getAccessTokenSync()));
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await fetch(input as RequestInfo, withAuth(refreshed));
    } else {
      await clearSession();
    }
  }
  return res;
};

// --- Presigned upload ---------------------------------------------------------
// PUT a local file (from the camera / picker / scanner) straight to the S3/MinIO
// presigned URL returned by ledger.getUploadUrl / media.getUploadUrl.

export async function uploadToPresignedUrl(
  uploadUrl: string,
  fileUri: string,
  mimeType: string,
): Promise<void> {
  const res = await FileSystem.uploadAsync(uploadUrl, fileUri, {
    httpMethod: "PUT",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { "Content-Type": mimeType },
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Upload failed (${res.status})`);
  }
}

export async function fileSize(fileUri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(fileUri);
  return info.exists && !info.isDirectory ? info.size : 0;
}
