import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { colors } from "../../lib/theme";

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("nav.today"),
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="prep"
        options={{
          title: t("foodPrep.title"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="nutrition-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: t("nav.schedule"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="animals"
        options={{
          title: t("nav.animals"),
          tabBarIcon: ({ color, size }) => <Ionicons name="paw-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
