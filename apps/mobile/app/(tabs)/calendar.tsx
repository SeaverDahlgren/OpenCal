import { useCallback, useMemo, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { createApiClient } from "../../src/api/client";
import type { CalendarDayDto, CalendarMonthDto } from "../../src/api/types";
import { EditorialHeader } from "../../src/components/EditorialHeader";
import { InlineNotice } from "../../src/components/InlineNotice";
import { SurfaceCard } from "../../src/components/SurfaceCard";
import { useSession } from "../../src/state/session";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";

export default function CalendarScreen() {
  const { token } = useSession();
  const [month, setMonth] = useState<CalendarMonthDto | null>(null);
  const [day, setDay] = useState<CalendarDayDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const today = useMemo(() => new Date(), []);
  const router = useRouter();

  const loadMonth = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient(token);
      const focusDate = selectedDate || new Date().toISOString().slice(0, 10);
      const [nextMonth, nextDay] = await Promise.all([
        client.getCalendarMonth(today.getFullYear(), today.getMonth() + 1),
        client.getCalendarDay(focusDate),
      ]);
      setMonth(nextMonth);
      setDay(nextDay);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load calendar.");
    } finally {
      setLoading(false);
    }
  }, [selectedDate, today, token]);

  async function selectDay(date: string) {
    if (!token) {
      return;
    }
    setSelectedDate(date);
    setError(null);
    try {
      setDay(await createApiClient(token).getCalendarDay(date));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load day details.");
    }
  }

  useFocusEffect(
    useCallback(() => {
      void loadMonth();
    }, [loadMonth]),
  );

  if (loading || !month) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void loadMonth()} tintColor={colors.primary} />}
    >
      <EditorialHeader eyebrow="STRATEGIC OVERVIEW" title={month.monthLabel} subtitle="Primary calendar with AI-assisted rescheduling." />
      {error ? <InlineNotice tone="error" message={error} actionLabel="Retry" onPress={() => void loadMonth()} /> : null}
      <SurfaceCard style={styles.monthCard}>
        <View style={styles.weekdays}>
          {["M", "T", "W", "T", "F", "S", "S"].map((label, index) => (
            <Text key={`${label}-${index}`} style={styles.weekday}>
              {label}
            </Text>
          ))}
        </View>
        <View style={styles.grid}>
        {month.days.map((item) => (
          <Pressable
            key={item.date}
            style={[
              styles.cell,
              !item.inMonth && styles.cellMuted,
              item.isToday && styles.cellToday,
              item.date === selectedDate && styles.cellSelected,
            ]}
            onPress={() => void selectDay(item.date)}
          >
            <Text style={[styles.cellText, item.isToday && styles.cellTextToday]}>{item.date.slice(-2)}</Text>
            <View style={styles.dots}>
              {item.highlights.map((highlight, index) => (
                <View
                  key={`${item.date}-${index}`}
                  style={[
                    styles.dot,
                    { backgroundColor: highlight.tone === "tertiary" ? colors.tertiary : colors.primary },
                  ]}
                />
              ))}
            </View>
            <Text style={styles.count}>{item.eventCount > 0 ? item.eventCount : ""}</Text>
          </Pressable>
        ))}
        </View>
      </SurfaceCard>

      <SurfaceCard elevated style={styles.timeline}>
        <Text style={styles.sectionTitle}>{day?.dateLabel ?? "Day Details"}</Text>
        {day?.items.length ? (
          day.items.map((item) => (
            <View key={item.eventId} style={styles.eventCard}>
              <Text style={styles.eventTime}>{item.timeLabel}</Text>
              <Text style={styles.eventTitle}>{item.title}</Text>
              {item.attendees.length ? (
                <Text style={styles.eventMeta}>{item.attendees.map((attendee) => attendee.name).join(", ")}</Text>
              ) : null}
              <TouchableOpacity
                style={styles.eventActionButton}
                onPress={() =>
                  router.push(
                    `/chat?prompt=${encodeURIComponent(
                      `Help me reschedule ${item.title} on ${day?.dateLabel ?? selectedDate} currently at ${item.timeLabel}.`,
                    )}`,
                  )
                }
              >
                <Text style={styles.eventAction}>Reschedule with AI</Text>
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <Text style={styles.muted}>No events for this day.</Text>
        )}
      </SurfaceCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 120 },
  loader: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  monthCard: { gap: spacing.md },
  weekdays: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 2 },
  weekday: { width: "13.5%", textAlign: "center", color: colors.textMuted, ...typography.label },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  cell: {
    width: "13.5%",
    aspectRatio: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 8,
    justifyContent: "space-between",
  },
  cellMuted: { opacity: 0.4 },
  cellToday: { backgroundColor: colors.surfaceHigh },
  cellSelected: { borderWidth: 1, borderColor: colors.primary },
  cellText: { color: colors.text, fontWeight: "700" },
  cellTextToday: { color: colors.primary },
  dots: { flexDirection: "row", gap: 3, minHeight: 8 },
  dot: { width: 6, height: 6, borderRadius: 999 },
  count: { color: colors.tertiary, fontSize: 10, fontWeight: "700", alignSelf: "flex-end" },
  timeline: { gap: spacing.md },
  sectionTitle: { color: colors.text, ...typography.section },
  eventCard: { gap: 4, paddingVertical: spacing.sm },
  eventTime: { color: colors.primary, ...typography.label },
  eventTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
  eventMeta: { color: colors.textMuted, ...typography.body },
  eventActionButton: { alignSelf: "flex-start", paddingTop: spacing.xs, paddingBottom: spacing.sm },
  eventAction: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  muted: { color: colors.textMuted },
});
