import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "../theme/tokens";

export function FloatingAIButton({ blocked }: { blocked: boolean }) {
  return (
    <Link href="/chat" asChild>
      <Pressable style={styles.link}>
        <View style={styles.button}>
        <Text style={styles.icon}>AI</Text>
        {blocked ? <View style={styles.badge} /> : null}
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  link: {
    position: "absolute",
    right: spacing.lg,
    bottom: 76,
    zIndex: 10,
  },
  button: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: colors.tertiary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.tertiary,
    shadowOpacity: 0.25,
    shadowRadius: 18,
  },
  icon: {
    color: colors.background,
    fontSize: 18,
    fontWeight: "700",
  },
  badge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
});
