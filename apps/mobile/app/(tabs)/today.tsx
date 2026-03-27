import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { createApiClient } from "../../src/api/client";
import type { TodayDto } from "../../src/api/types";
import { EditorialHeader } from "../../src/components/EditorialHeader";
import { InlineNotice } from "../../src/components/InlineNotice";
import { SurfaceCard } from "../../src/components/SurfaceCard";
import { useSession } from "../../src/state/session";
import { colors, spacing, typography } from "../../src/theme/tokens";

export default function TodayScreen() {
  const { token, scheduleVersion } = useSession();
  const [data, setData] = useState<TodayDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const loadedRef = useRef(false);

  const load = useCallback(async (options?: { refreshing?: boolean }) => {
    if (!token) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (options?.refreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      setData(await createApiClient(token).getToday());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load today.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadedRef.current = true;
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!token || !loadedRef.current) {
      return;
    }
    void load();
  }, [load, scheduleVersion, token]);

  if (loading && !data) {
    return <CenteredLoader />;
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load({ refreshing: true })} tintColor={colors.primary} />}
    >
      <EditorialHeader eyebrow={formatTodayEyebrow(data?.date)} title={data?.greeting ?? "Today"} subtitle="Strategic overview of your day." />
      {error ? <InlineNotice tone="error" message={error} actionLabel="Retry" onPress={() => void load()} /> : null}
      {data?.insight ? (
        <SurfaceCard elevated style={styles.insight}>
          <Text style={styles.insightEyebrow}>AI INTELLIGENCE</Text>
          <Text style={styles.insightTitle}>{data.insight.title}</Text>
          <Text style={styles.insightBody}>{data.insight.body}</Text>
          {data.insight.action?.prompt ? (
            <TouchableOpacity
              style={styles.inlineActionButton}
              onPress={() => router.push(`/chat?prompt=${encodeURIComponent(data.insight!.action!.prompt)}`)}
            >
              <Text style={styles.inlineAction}>{data.insight.actionLabel}</Text>
            </TouchableOpacity>
          ) : null}
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

function formatTodayEyebrow(date?: string) {
  if (!date) {
    return undefined;
  }

  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
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
  inlineActionButton: { alignSelf: "flex-start", paddingVertical: spacing.sm },
  inlineAction: { color: colors.primary, fontSize: 15, fontWeight: "800" },
  muted: { color: colors.textMuted, fontSize: 16 },
});
