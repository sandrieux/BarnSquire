import type { ExpoConfig, ConfigContext } from "expo/config";

// The API base URL is read from the EXPO_PUBLIC_API_URL env var (or app config
// `extra`), so the same binary can point at dev / staging / prod.
export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EAS_PROJECT_ID ?? "5fc846da-9243-4d5c-b1d2-cc03fbb4f0a6";
  // Fallback API base when EXPO_PUBLIC_API_URL isn't set at export time. This is
  // the PRODUCTION url on purpose: `eas update` (unlike `eas build`) does NOT
  // read eas.json build-profile env, and apps/mobile/.env.local is gitignored,
  // so a missing var must never silently fall back to localhost — that value
  // gets baked into the OTA manifest and would reset every installed app to a
  // dev server. Local dev opts into localhost explicitly via .env.local or the
  // development/device build profiles.
  const fallbackApiUrl = "https://barnsquire.lysranch.com";
  return {
    ...config,
    name: "BarnSquire",
    slug: "barnsquire",
    owner: "sandrieux",
    version: "0.1.0",
    // iOS/Android only (distributed via TestFlight/Play). Declaring this keeps
    // `eas update` — which exports --platform=all — from trying to bundle web,
    // which would require react-native-web that we don't ship.
    platforms: ["ios", "android"],
    // EAS Update (OTA): JS-only changes ship over-the-air to installed builds.
    // runtimeVersion gates compatibility — a build only accepts updates with a
    // matching runtimeVersion. "appVersion" ties it to `version` above, so every
    // build of 0.1.0 shares one runtimeVersion. IMPORTANT: bump `version` whenever
    // you change native code/deps or add a native module, so an OTA JS update
    // never lands on an incompatible older binary.
    runtimeVersion: { policy: "appVersion" },
    updates: {
      url: `https://u.expo.dev/${projectId}`,
    },
    // Rendered from the Lys Ranch logo; editable SVG sources live next to the PNGs in assets/
    icon: "./assets/icon.png",
    orientation: "portrait",
    scheme: "barnsquire",
    userInterfaceStyle: "automatic",
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.barnsquire.app",
      infoPlist: {
        NSCameraUsageDescription:
          "BarnSquire uses the camera to photograph and scan documents for the animal ledger, and to scan stall QR codes.",
        NSPhotoLibraryUsageDescription:
          "BarnSquire attaches photos from your library to the animal ledger.",
        NSFaceIDUsageDescription: "BarnSquire uses Face ID to unlock the app.",
        // Allow plain-HTTP to LAN dev servers (private IPs / .local) so a physical
        // device can reach `http://<mac-ip>:3000`. App-Store-safe — it does NOT
        // permit arbitrary cleartext to public hosts.
        NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
        // Standard HTTPS only — answers App Store Connect's export-compliance
        // question up front so TestFlight builds aren't held for it.
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: "com.barnsquire.app",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#F6F1E7",
      },
      permissions: ["CAMERA"],
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      "expo-localization",
      [
        "expo-camera",
        {
          cameraPermission:
            "BarnSquire uses the camera to photograph/scan for the ledger and to scan stall QR codes.",
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "BarnSquire attaches photos from your library to the animal ledger.",
        },
      ],
      "expo-local-authentication",
      "expo-notifications",
      "./plugins/withFmtBuildFix",
      "./plugins/withDisableScriptSandboxing",
    ],
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL ?? fallbackApiUrl,
      // EAS project id (also used for Expo push token registration). Not secret.
      eas: { projectId },
    },
  };
};
