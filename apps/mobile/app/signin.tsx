import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSession } from "../src/state/session";
import { colors, radii, spacing } from "../src/theme/tokens";

export default function SignInScreen() {
  const { startAuth, loading } = useSession();

  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>OPENCALE PRIVATE BETA</Text>
      <Text style={styles.title}>Sign in with your backend-owned Google account.</Text>
      <Text style={styles.body}>
        OpenCal uses your backend session for Calendar and Gmail access. The browser handoff will return a session token to the app.
      </Text>
      <TouchableOpacity style={styles.button} onPress={() => void startAuth()} disabled={loading}>
        <Text style={styles.buttonText}>Continue with Google</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
    justifyContent: "center",
    gap: spacing.md,
  },
  eyebrow: {
    color: colors.tertiary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "800",
  },
  body: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  button: {
    marginTop: spacing.lg,
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
