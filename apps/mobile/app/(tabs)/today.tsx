import { useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { createApiClient } from "../../src/api/client";
import type { TodayDto } from "../../src/api/types";
import { useSession } from "../../src/state/session";
import { colors, radii, spacing } from "../../src/theme/tokens";

export default function TodayScreen() {
  const { token } = useSession();
  const [data, setData] = useState<TodayDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!token) {
      return;
    }
    setError(null);
    try {
      setData(await createApiClient(token).getToday());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load today.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  if (loading) {
    return <CenteredLoader />;
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />}
    >
      <Text style={styles.eyebrow}>{data?.date}</Text>
      <Text style={styles.title}>{data?.greeting ?? "Today"}</Text>
      {error ? <InlineError message={error} onRetry={() => void load()} /> : null}
      {data?.insight ? (
        <View style={styles.insight}>
          <Text style={styles.insightTitle}>{data.insight.title}</Text>
          <Text style={styles.insightBody}>{data.insight.body}</Text>
        </View>
      ) : null}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Today&apos;s Schedule</Text>
        {data?.schedule.length ? (
          data.schedule.map((event) => (
            <View key={event.eventId} style={styles.eventRow}>
              <Text style={styles.eventTime}>{event.timeLabel}</Text>
              <Text style={styles.eventTitle}>{event.title}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.muted}>No events scheduled.</Text>
        )}
      </View>
    </ScrollView>
  );
}

function CenteredLoader() {
  return (
    <View style={styles.loader}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.error}>
      <Text style={styles.errorText}>{message}</Text>
      <TouchableOpacity onPress={onRetry}>
        <Text style={styles.retry}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 120 },
  loader: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: colors.tertiary, fontSize: 12, fontWeight: "700", letterSpacing: 2 },
  title: { color: colors.text, fontSize: 42, fontWeight: "800" },
  card: { backgroundColor: colors.surfaceHigh, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: "700" },
  eventRow: { gap: 4, paddingVertical: spacing.sm },
  eventTime: { color: colors.primary, fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  eventTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
  insight: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.lg, gap: spacing.sm },
  insightTitle: { color: colors.text, fontSize: 24, fontWeight: "800" },
  insightBody: { color: colors.textMuted, fontSize: 16, lineHeight: 22 },
  muted: { color: colors.textMuted, fontSize: 16 },
  error: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  errorText: { color: colors.error, flex: 1, marginRight: spacing.md },
  retry: { color: colors.primary, fontWeight: "700" },
});
