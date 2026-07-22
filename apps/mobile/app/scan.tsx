import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { parseTag, type TagPayload } from "@barnsquire/validators";
import { useBarn } from "../lib/barn";
import { AppButton } from "../components/ui";
import { colors } from "../lib/theme";

export default function ScanScreen() {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const router = useRouter();
  const { barns, setBarnId } = useBarn();
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Deep-link entry: an OS-camera scan opens `barnsquire://scan?t=…&b=…&id=…`,
  // which lands here as route params. Dispatch it once on mount.
  const params = useLocalSearchParams<{ t?: string; b?: string; id?: string }>();
  const deepLinked = useRef(false);

  // Routes a parsed tag to the right screen. Returns false if it can't (unknown
  // tag, or a location/barn tag for a barn this user has no access to).
  function dispatch(payload: TagPayload): boolean {
    if (payload.type === "animal") {
      router.replace(`/animal/${payload.id}`);
      return true;
    }
    // Location/barn tags need a barn the caller belongs to.
    if (!payload.barnId || !barns.some((b) => b.id === payload.barnId)) return false;
    setBarnId(payload.barnId);
    switch (payload.type) {
      case "stall":
        router.replace({ pathname: "/(tabs)/animals", params: { stallId: payload.id } });
        return true;
      case "pasture":
        router.replace({ pathname: "/(tabs)/animals", params: { pastureId: payload.id } });
        return true;
      default:
        // barn / building / arena → switch barn and open Today (MVP).
        router.replace("/(tabs)");
        return true;
    }
  }

  useEffect(() => {
    if (deepLinked.current) return;
    if (params.t && params.id) {
      deepLinked.current = true;
      const payload: TagPayload = {
        type: params.t as TagPayload["type"],
        barnId: params.b,
        id: params.id,
      };
      if (!dispatch(payload)) setError(t("scan.barnNotAccessible"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.t, params.id, params.b]);

  function handleScan(result: { data: string }) {
    if (scanned) return;
    setScanned(true);
    const payload = parseTag(result.data);
    if (payload && dispatch(payload)) return;
    setError(payload ? t("scan.barnNotAccessible") : t("scan.notATag"));
    setTimeout(() => setScanned(false), 1500);
  }

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>Camera access is needed to scan stall QR codes.</Text>
        <AppButton title="Grant access" onPress={() => void requestPermission()} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanned ? undefined : handleScan}
      />
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.reticle} />
        <Text style={styles.hint}>Point at a stall QR code</Text>
      </View>
      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      <View style={styles.closeWrap}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
    backgroundColor: colors.bg,
  },
  msg: { textAlign: "center", color: colors.text, fontSize: 16 },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 20 },
  reticle: {
    width: 240,
    height: 240,
    borderWidth: 3,
    borderColor: "#ffffffcc",
    borderRadius: 20,
    backgroundColor: "transparent",
  },
  hint: { color: "#fff", fontSize: 16, fontWeight: "600" },
  errorBar: {
    position: "absolute",
    bottom: 120,
    alignSelf: "center",
    backgroundColor: colors.danger,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  errorText: { color: "#fff" },
  closeWrap: { position: "absolute", bottom: 40, alignSelf: "center" },
  closeBtn: { backgroundColor: "#ffffff22", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 },
  closeText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
