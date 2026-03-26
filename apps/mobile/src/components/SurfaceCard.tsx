import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { colors, radii, spacing } from "../theme/tokens";

export function SurfaceCard({
  children,
  elevated = false,
  style,
}: {
  children: ReactNode;
  elevated?: boolean;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, elevated ? styles.elevated : styles.flat, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  flat: {
    backgroundColor: colors.surface,
  },
  elevated: {
    backgroundColor: colors.surfaceHigh,
    shadowColor: "#000000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
});
