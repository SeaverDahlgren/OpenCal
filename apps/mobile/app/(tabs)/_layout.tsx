import { Tabs } from "expo-router";
import { View } from "react-native";
import { FloatingAIButton } from "../../src/components/FloatingAIButton";
import { useSession } from "../../src/state/session";
import { colors } from "../../src/theme/tokens";

export default function TabsLayout() {
  const { blocked } = useSession();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.primary,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: "transparent" },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          sceneStyle: { backgroundColor: colors.background },
        }}
      >
        <Tabs.Screen name="today" options={{ title: "Today" }} />
        <Tabs.Screen name="calendar" options={{ title: "Calendar" }} />
        <Tabs.Screen name="settings" options={{ title: "Settings" }} />
      </Tabs>
      <FloatingAIButton blocked={blocked} />
    </View>
  );
}
