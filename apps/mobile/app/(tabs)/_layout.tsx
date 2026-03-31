import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";
import { FloatingAIButton } from "../../src/components/FloatingAIButton";
import { getSettingsTabIcon } from "../../src/navigation/tab-icons";
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
        <Tabs.Screen
          name="today"
          options={{
            title: "Today",
            tabBarIcon: ({ color, size, focused }) => <TodayTabIcon color={color} size={size} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: "Calendar",
            tabBarIcon: ({ color, size, focused }) => <CalendarTabIcon color={color} size={size} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, size, focused }) => <SettingsTabIcon color={color} size={size} focused={focused} />,
          }}
        />
      </Tabs>
      <FloatingAIButton blocked={blocked} />
    </View>
  );
}

function TodayTabIcon(props: {
  color: string;
  size: number;
  focused: boolean;
}) {
  return (
    <View
      style={[
        styles.todayIcon,
        {
          width: props.size,
          height: props.size,
          borderColor: props.color,
          backgroundColor: props.focused ? `${props.color}18` : "transparent",
        },
      ]}
    >
      <View style={[styles.todayDot, { backgroundColor: props.color }]} />
    </View>
  );
}

function CalendarTabIcon(props: {
  color: string;
  size: number;
  focused: boolean;
}) {
  const bodyHeight = Math.max(14, props.size - 2);
  const accent = props.focused ? `${props.color}18` : "transparent";

  return (
    <View
      style={[
        styles.calendarIcon,
        {
          width: props.size,
          height: bodyHeight,
          borderColor: props.color,
          backgroundColor: accent,
        },
      ]}
    >
      <View style={[styles.calendarHeader, { backgroundColor: props.color }]} />
      <View style={styles.calendarGrid}>
        <View style={[styles.calendarCell, { backgroundColor: props.color }]} />
        <View style={[styles.calendarCell, { backgroundColor: props.color }]} />
        <View style={[styles.calendarCell, { backgroundColor: props.color }]} />
        <View style={[styles.calendarCell, { backgroundColor: props.color }]} />
      </View>
    </View>
  );
}

function SettingsTabIcon(props: {
  color: string;
  size: number;
  focused: boolean;
}) {
  const icon = getSettingsTabIcon();

  return (
    <View
      style={[
        styles.settingsWrap,
        {
          width: props.size,
          height: props.size,
          backgroundColor: props.focused ? `${props.color}18` : "transparent",
        },
      ]}
    >
      <Feather name={icon.name} size={Math.max(16, props.size - 2)} color={props.color} />
    </View>
  );
}

const styles = StyleSheet.create({
  todayIcon: {
    borderWidth: 1.6,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  todayDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  calendarIcon: {
    borderWidth: 1.6,
    borderRadius: 6,
    overflow: "hidden",
  },
  calendarHeader: {
    height: 4,
    width: "100%",
  },
  calendarGrid: {
    flex: 1,
    paddingHorizontal: 3,
    paddingVertical: 3,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
    alignContent: "flex-start",
  },
  calendarCell: {
    width: 3,
    height: 3,
    borderRadius: 999,
  },
  settingsWrap: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
});
