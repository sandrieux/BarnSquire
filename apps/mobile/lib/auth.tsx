import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as LocalAuthentication from "expo-local-authentication";
import { loginRequest, type MobileUser } from "./api";
import { clearSession, loadSession, setSession } from "./tokenStore";

// Auth states:
//  loading   – reading persisted session on launch
//  signedOut – no stored refresh token; show login
//  locked    – have a session but require biometric unlock first
//  signedIn  – unlocked and usable
type Status = "loading" | "signedOut" | "locked" | "signedIn";

interface AuthContextValue {
  status: Status;
  user: MobileUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  unlock: () => Promise<boolean>;
  setUser: (user: MobileUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<MobileUser | null>(null);

  useEffect(() => {
    (async () => {
      const { refreshToken, user: storedUser } = await loadSession();
      if (refreshToken && storedUser) {
        setUser(storedUser);
        const canBiometric =
          (await LocalAuthentication.hasHardwareAsync()) &&
          (await LocalAuthentication.isEnrolledAsync());
        setStatus(canBiometric ? "locked" : "signedIn");
      } else {
        setStatus("signedOut");
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken, refreshToken, user: u } = await loginRequest(email, password);
    await setSession(accessToken, refreshToken, u);
    setUser(u);
    setStatus("signedIn");
  }, []);

  const logout = useCallback(async () => {
    await clearSession();
    setUser(null);
    setStatus("signedOut");
  }, []);

  const unlock = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock BarnSquire",
      fallbackLabel: "Use passcode",
    });
    if (result.success) {
      setStatus("signedIn");
      return true;
    }
    return false;
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, login, logout, unlock, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}
