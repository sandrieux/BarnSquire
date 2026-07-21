import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { EAS_PROJECT_ID } from "./config";

// Show a banner even when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Requests permission and returns the Expo push token for this device (or null if
// unavailable / denied). Push requires a real device and a dev/EAS build.
export async function registerForPushToken(): Promise<{ token: string; platform: string } | null> {
  if (!Device.isDevice) return null;

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted) {
    granted = (await Notifications.requestPermissionsAsync()).granted;
  }
  if (!granted) return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync(
      EAS_PROJECT_ID ? { projectId: EAS_PROJECT_ID } : undefined,
    );
    return { token: data, platform: Platform.OS };
  } catch {
    return null;
  }
}
