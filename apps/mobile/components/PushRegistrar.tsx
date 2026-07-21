import { useEffect, useRef } from "react";
import { useAuth } from "../lib/auth";
import { trpc } from "../lib/trpc";
import { registerForPushToken } from "../lib/notifications";

// Registers this device's Expo push token once the user is signed in.
export function PushRegistrar() {
  const { status } = useAuth();
  const register = trpc.notification.registerDevice.useMutation();
  const doneRef = useRef(false);

  useEffect(() => {
    if (status !== "signedIn" || doneRef.current) return;
    doneRef.current = true;
    void registerForPushToken().then((res) => {
      if (res) register.mutate(res);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return null;
}
