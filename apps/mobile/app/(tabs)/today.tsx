import { useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { createApiClient } from "../../src/api/client";
import type { TodayDto } from "../../src/api/types";
import { EditorialHeader } from "../../src/components/EditorialHeader";
import { InlineNotice } from "../../src/components/InlineNotice";
import { SurfaceCard } from "../../src/components/SurfaceCard";
import { useSession } from "../../src/state/session";
import { colors, spacing, typography } from "../../src/theme/tokens";

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
      <EditorialHeader eyebrow={data?.date} title={data?.greeting ?? "Today"} subtitle="Strategic overview of your day." />
      {error ? <InlineNotice tone="error" message={error} actionLabel="Retry" onPress={() => void load()} /> : null}
      {data?.insight ? (
        <SurfaceCard elevated style={styles.insight}>
          <Text style={styles.insightEyebrow}>AI INTELLIGENCE</Text>
          <Text style={styles.insightTitle}>{data.insight.title}</Text>
          <Text style={styles.insightBody}>{data.insight.body}</Text>
        </SurfaceCard>
      ) : null}
      <SurfaceCard elevated>
        <Text style={styles.sectionTitle}>Today&apos;s Schedule</Text>
        {data?.schedule.length ? (
          data.schedule.map((event) => (
            <View key={event.eventId} style={styles.eventRow}>
              <View style={styles.track} />
              <View style={styles.eventContent}>
                <Text style={styles.eventTime}>{event.timeLabel}</Text>
                <Text style={styles.eventTitle}>{event.title}</Text>
                {event.attendeePreview.length ? (
                  <Text style={styles.eventMeta}>{event.attendeePreview.join(", ")}</Text>
                ) : null}
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.muted}>No events scheduled.</Text>
        )}
      </SurfaceCard>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 120 },
  loader: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  sectionTitle: { color: colors.text, ...typography.section },
  eventRow: { flexDirection: "row", gap: spacing.md, paddingVertical: spacing.sm },
  track: { width: 4, borderRadius: 999, backgroundColor: colors.primaryDim },
  eventContent: { flex: 1, gap: 4 },
  eventTime: { color: colors.primary, ...typography.label },
  eventTitle: { color: colors.text, fontSize: 20, fontWeight: "700" },
  eventMeta: { color: colors.textMuted, ...typography.body },
  insight: { backgroundColor: colors.surfaceHigh },
  insightEyebrow: { color: colors.tertiary, ...typography.eyebrow },
  insightTitle: { color: colors.text, fontSize: 24, fontWeight: "800" },
  insightBody: { color: colors.textMuted, fontSize: 16, lineHeight: 22 },
  muted: { color: colors.textMuted, fontSize: 16 },
});
