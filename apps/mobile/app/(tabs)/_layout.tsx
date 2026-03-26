import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";
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
  const outer = Math.max(16, props.size - 2);
  const inner = Math.max(6, Math.round(outer * 0.34));
  const tooth = Math.max(4, Math.round(outer * 0.22));

  return (
    <View style={[styles.settingsWrap, { width: props.size, height: props.size }]}>
      <View style={[styles.gearTooth, styles.gearToothTop, { width: tooth, height: tooth, backgroundColor: props.color }]} />
      <View style={[styles.gearTooth, styles.gearToothBottom, { width: tooth, height: tooth, backgroundColor: props.color }]} />
      <View style={[styles.gearTooth, styles.gearToothLeft, { width: tooth, height: tooth, backgroundColor: props.color }]} />
      <View style={[styles.gearTooth, styles.gearToothRight, { width: tooth, height: tooth, backgroundColor: props.color }]} />
      <View style={[styles.gearTooth, styles.gearToothTopLeft, { width: tooth, height: tooth, backgroundColor: props.color }]} />
      <View style={[styles.gearTooth, styles.gearToothTopRight, { width: tooth, height: tooth, backgroundColor: props.color }]} />
      <View style={[styles.gearTooth, styles.gearToothBottomLeft, { width: tooth, height: tooth, backgroundColor: props.color }]} />
      <View style={[styles.gearTooth, styles.gearToothBottomRight, { width: tooth, height: tooth, backgroundColor: props.color }]} />
      <View
        style={[
          styles.settingsOuter,
          {
            width: outer,
            height: outer,
            borderColor: props.color,
            backgroundColor: props.focused ? `${props.color}18` : "transparent",
          },
        ]}
      >
        <View style={[styles.settingsInner, { width: inner, height: inner, backgroundColor: props.color }]} />
      </View>
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
  },
  gearTooth: {
    position: "absolute",
    borderRadius: 2,
  },
  gearToothTop: {
    top: 0,
  },
  gearToothBottom: {
    bottom: 0,
  },
  gearToothLeft: {
    left: 0,
  },
  gearToothRight: {
    right: 0,
  },
  gearToothTopLeft: {
    top: 2,
    left: 2,
    transform: [{ rotate: "45deg" }],
  },
  gearToothTopRight: {
    top: 2,
    right: 2,
    transform: [{ rotate: "45deg" }],
  },
  gearToothBottomLeft: {
    bottom: 2,
    left: 2,
    transform: [{ rotate: "45deg" }],
  },
  gearToothBottomRight: {
    bottom: 2,
    right: 2,
    transform: [{ rotate: "45deg" }],
  },
  settingsOuter: {
    borderWidth: 1.6,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsInner: {
    borderRadius: 999,
  },
});
