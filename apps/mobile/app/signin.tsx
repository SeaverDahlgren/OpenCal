import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { AppLogo } from "../src/components/AppLogo";
import { useSession } from "../src/state/session";
import { colors, radii, spacing, typography } from "../src/theme/tokens";

export default function SignInScreen() {
  const { startAuth, loading, authError } = useSession();

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <AppLogo size={88} centered />
        <Text style={styles.title}>Welcome to OpenCal!</Text>
        <Text style={styles.subtitle}>Sign in to get started</Text>
      </View>
      <View style={styles.centerBlock}>
        {loading ? <Text style={styles.loadingText}>Checking for an existing beta session...</Text> : null}
        {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
        <TouchableOpacity style={styles.button} onPress={() => void startAuth()} disabled={loading}>
          <Text style={styles.buttonText}>Sign in with Google</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.xxl,
  },
  header: {
    gap: spacing.sm,
    alignItems: "center",
  },
  title: {
    color: colors.text,
    ...typography.title,
    textAlign: "center",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
  },
  centerBlock: {
    width: "100%",
    maxWidth: 320,
    gap: spacing.md,
  },
  loadingText: {
    color: colors.tertiary,
    fontSize: 14,
    textAlign: "center",
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  buttonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
});
