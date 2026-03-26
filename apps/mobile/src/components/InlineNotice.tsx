import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, radii, spacing, typography } from "../theme/tokens";

export function InlineNotice({
  tone,
  message,
  actionLabel,
  onPress,
}: {
  tone: "error" | "info" | "success";
  message: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  return (
    <View style={[styles.wrap, tone === "error" ? styles.error : styles.info]}>
      <Text style={[styles.message, tone === "error" ? styles.errorText : styles.infoText]}>{message}</Text>
      {actionLabel && onPress ? (
        <TouchableOpacity onPress={onPress}>
          <Text style={styles.action}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  error: {
    backgroundColor: "rgba(255,113,108,0.08)",
  },
  info: {
    backgroundColor: colors.surfaceHigh,
  },
  message: {
    flex: 1,
    ...typography.body,
  },
  errorText: {
    color: colors.error,
  },
  infoText: {
    color: colors.textMuted,
  },
  action: {
    color: colors.primary,
    fontWeight: "700",
  },
});
