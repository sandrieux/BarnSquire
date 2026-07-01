import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { trpc } from "./trpc";
import { useAuth } from "./auth";

interface Barn {
  id: string;
  name: string;
  timezone?: string | null;
  role?: string;
}

interface BarnContextValue {
  barns: Barn[];
  barnId: string | null;
  barn: Barn | null;
  timezone: string;
  setBarnId: (id: string) => void;
  isLoading: boolean;
}

const BarnContext = createContext<BarnContextValue | null>(null);
const BARN_KEY = "bs_barn_id";

export function useBarn(): BarnContextValue {
  const ctx = useContext(BarnContext);
  if (!ctx) throw new Error("useBarn must be used within BarnProvider");
  return ctx;
}

export function BarnProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const [barnId, setBarnIdState] = useState<string | null>(null);

  const barnsQuery = trpc.barn.list.useQuery(undefined, {
    enabled: status === "signedIn",
  });
  const barns = (barnsQuery.data ?? []) as Barn[];

  useEffect(() => {
    void AsyncStorage.getItem(BARN_KEY).then((stored) => {
      if (stored) setBarnIdState(stored);
    });
  }, []);

  // Default to the first barn once loaded (or if the stored one disappeared).
  useEffect(() => {
    if (barns.length === 0) return;
    if (!barnId || !barns.some((b) => b.id === barnId)) {
      setBarnIdState(barns[0]!.id);
    }
  }, [barns, barnId]);

  const setBarnId = (id: string) => {
    setBarnIdState(id);
    void AsyncStorage.setItem(BARN_KEY, id);
  };

  const barn = useMemo(() => barns.find((b) => b.id === barnId) ?? null, [barns, barnId]);

  const value: BarnContextValue = {
    barns,
    barnId,
    barn,
    timezone: barn?.timezone ?? "UTC",
    setBarnId,
    isLoading: barnsQuery.isLoading,
  };

  return <BarnContext.Provider value={value}>{children}</BarnContext.Provider>;
}
