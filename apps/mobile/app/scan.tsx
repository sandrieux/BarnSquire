import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { AppButton } from "../components/ui";
import { colors } from "../lib/theme";

// Accepts a raw cuid, or any string/URL containing "animal/<id>".
function extractAnimalId(data: string): string | null {
  const trimmed = data.trim();
  const m = trimmed.match(/animal\/([a-z0-9]+)/i);
  if (m?.[1]) return m[1];
  if (/^c[a-z0-9]{20,}$/i.test(trimmed)) return trimmed;
  return null;
}

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const router = useRouter();
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleScan(result: { data: string }) {
    if (scanned) return;
    setScanned(true);
    const id = extractAnimalId(result.data);
    if (id) {
      router.replace(`/animal/${id}`);
    } else {
      setError("That QR code isn't a BarnSquire stall tag.");
      setTimeout(() => setScanned(false), 1500);
    }
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
