import type { ExpoConfig, ConfigContext } from "expo/config";

// The API base URL is read from the EXPO_PUBLIC_API_URL env var (or app config
// `extra`), so the same binary can point at dev / staging / prod.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "BarnSquire",
  slug: "barnsquire",
  owner: "sandrieux",
  version: "0.1.0",
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
    },
  },
  android: {
    package: "com.barnsquire.app",
    adaptiveIcon: { backgroundColor: "#ffffff" },
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
  ],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000",
    // EAS project id (also used for Expo push token registration). Not secret.
    eas: { projectId: process.env.EAS_PROJECT_ID ?? "5fc846da-9243-4d5c-b1d2-cc03fbb4f0a6" },
  },
});
