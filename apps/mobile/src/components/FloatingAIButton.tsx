import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii, spacing } from "../theme/tokens";

export function FloatingAIButton({ blocked }: { blocked: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/chat")}
        style={[styles.link, { bottom: insets.bottom + 72 }]}
      >
        <View style={styles.button}>
          <View style={styles.robotWrap}>
            <View style={styles.robotAntenna} />
            <View style={styles.robotHead}>
              <View style={styles.robotEyes}>
                <View style={styles.robotEye} />
                <View style={styles.robotEye} />
              </View>
              <View style={styles.robotMouth} />
            </View>
          </View>
          {blocked ? <View style={styles.badge} /> : null}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  link: {
    position: "absolute",
    right: spacing.md,
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
  robotWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  robotAntenna: {
    width: 2,
    height: 6,
    backgroundColor: colors.background,
    borderRadius: radii.full,
    marginBottom: 2,
  },
  robotHead: {
    width: 24,
    height: 20,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  robotEyes: {
    flexDirection: "row",
    gap: 5,
  },
  robotEye: {
    width: 4,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.background,
  },
  robotMouth: {
    width: 10,
    height: 2,
    borderRadius: radii.full,
    backgroundColor: colors.background,
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
