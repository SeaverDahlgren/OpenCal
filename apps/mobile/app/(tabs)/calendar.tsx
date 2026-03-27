import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { ActivityIndicator, Animated, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { createApiClient } from "../../src/api/client";
import type { CalendarDayDto, CalendarMonthDto } from "../../src/api/types";
import { EditorialHeader } from "../../src/components/EditorialHeader";
import { InlineNotice } from "../../src/components/InlineNotice";
import { SurfaceCard } from "../../src/components/SurfaceCard";
import { useSession } from "../../src/state/session";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";

export default function CalendarScreen() {
  const { token, scheduleVersion } = useSession();
  const [month, setMonth] = useState<CalendarMonthDto | null>(null);
  const [day, setDay] = useState<CalendarDayDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [monthAnimating, setMonthAnimating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => toDateOnly(new Date()));
  const router = useRouter();
  const monthTranslate = useRef(new Animated.Value(0)).current;
  const monthOpacity = useRef(new Animated.Value(1)).current;
  const hasLoadedRef = useRef(false);
  const monthCacheRef = useRef<Record<string, CalendarMonthDto>>({});
  const monthRequestRef = useRef(0);
  const dayRequestRef = useRef(0);
  const hydrateRequestRef = useRef(0);
  const syncedScheduleVersionRef = useRef<number>(scheduleVersion);

  const loadMonthData = useCallback(async (targetMonth: Date) => {
    if (!token) {
      return;
    }
    const monthKey = getMonthKey(targetMonth);
    const requestId = ++monthRequestRef.current;
    const nextMonth = await createApiClient(token).getCalendarMonth(targetMonth.getFullYear(), targetMonth.getMonth() + 1);
    monthCacheRef.current[monthKey] = nextMonth;
    if (requestId !== monthRequestRef.current) {
      return;
    }
    setMonth(nextMonth);
  }, [token]);

  const loadDayData = useCallback(async (date: string) => {
    if (!token) {
      return;
    }
    const requestId = ++dayRequestRef.current;
    try {
      const nextDay = await createApiClient(token).getCalendarDay(date);
      if (requestId !== dayRequestRef.current) {
        return;
      }
      setDay(nextDay);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load calendar.");
    }
  }, [token]);

  const hydrateVisibleCalendar = useCallback(async (targetMonth: Date, focusDate: string, options?: {
    initial?: boolean;
    refreshing?: boolean;
  }) => {
    if (!token) {
      setLoading(false);
      return;
    }

    const isInitial = options?.initial ?? false;
    const isRefreshing = options?.refreshing ?? false;
    if (isInitial) {
      setLoading(true);
    }
    if (isRefreshing) {
      setRefreshing(true);
    }
    setError(null);
    const requestId = ++hydrateRequestRef.current;

    const monthKey = getMonthKey(targetMonth);

    try {
      const client = createApiClient(token);
      const [nextMonth, nextDay] = await Promise.all([
        client.getCalendarMonth(targetMonth.getFullYear(), targetMonth.getMonth() + 1),
        client.getCalendarDay(focusDate),
      ]);
      if (requestId !== hydrateRequestRef.current) {
        return;
      }
      monthCacheRef.current[monthKey] = nextMonth;
      setVisibleMonth(targetMonth);
      setSelectedDate(focusDate);
      setMonth(nextMonth);
      setDay(nextDay);
    } catch (nextError) {
      if (requestId !== hydrateRequestRef.current) {
        return;
      }
      setError(nextError instanceof Error ? nextError.message : "Failed to load calendar.");
    } finally {
      if (requestId === hydrateRequestRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [token]);

  const transitionMonth = useCallback(async (targetMonth: Date, targetDate: string, direction: number) => {
    if (!token || monthAnimating) {
      return;
    }

    const monthKey = getMonthKey(targetMonth);
    const optimisticMonth = monthCacheRef.current[monthKey] ?? buildPlaceholderMonth(targetMonth);

    setError(null);
    setMonthAnimating(true);

    try {
      if (direction && month) {
        await runMonthExitAnimation(monthTranslate, monthOpacity, direction);
      }

      setVisibleMonth(targetMonth);
      setSelectedDate(targetDate);
      setMonth(optimisticMonth);
      setDay(null);
      dayRequestRef.current += 1;

      if (direction && month) {
        monthTranslate.setValue(direction > 0 ? 22 : -22);
        monthOpacity.setValue(0.35);
        await runMonthEnterAnimation(monthTranslate, monthOpacity);
      }

      void loadMonthData(targetMonth);
      void loadDayData(targetDate);
    } finally {
      setMonthAnimating(false);
    }
  }, [loadDayData, loadMonthData, month, monthAnimating, monthOpacity, monthTranslate, token]);

  async function selectDay(date: string) {
    if (!token) {
      return;
    }
    const nextMonth = startOfMonth(new Date(`${date}T12:00:00`));
    const direction = nextMonth.getTime() === visibleMonth.getTime() ? 0 : nextMonth > visibleMonth ? 1 : -1;
    if (direction === 0) {
      setSelectedDate(date);
      setError(null);
      void loadDayData(date);
      return;
    }
    await transitionMonth(nextMonth, date, direction);
  }

  function moveMonth(offset: number) {
    const nextMonth = startOfMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1));
    const nextSelectedDate = toDateOnly(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1, 12));
    void transitionMonth(nextMonth, nextSelectedDate, offset);
  }

  useFocusEffect(
    useCallback(() => {
      if (!token) {
        setLoading(false);
        return;
      }
      if (hasLoadedRef.current) {
        if (syncedScheduleVersionRef.current !== scheduleVersion) {
          monthCacheRef.current = {};
          syncedScheduleVersionRef.current = scheduleVersion;
          void hydrateVisibleCalendar(visibleMonth, selectedDate);
        }
        return;
      }
      hasLoadedRef.current = true;
      syncedScheduleVersionRef.current = scheduleVersion;
      void hydrateVisibleCalendar(visibleMonth, selectedDate, { initial: true });
    }, [hydrateVisibleCalendar, scheduleVersion, selectedDate, token, visibleMonth]),
  );

  useEffect(() => {
    if (!token || !hasLoadedRef.current) {
      return;
    }
    monthCacheRef.current = {};
    syncedScheduleVersionRef.current = scheduleVersion;
    void hydrateVisibleCalendar(visibleMonth, selectedDate);
  }, [hydrateVisibleCalendar, scheduleVersion, selectedDate, token, visibleMonth]);

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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void hydrateVisibleCalendar(visibleMonth, selectedDate, { refreshing: true })} tintColor={colors.primary} />}
    >
      <EditorialHeader title={month.monthLabel} subtitle="" />
      {error ? <InlineNotice tone="error" message={error} actionLabel="Retry" onPress={() => void hydrateVisibleCalendar(visibleMonth, selectedDate, { refreshing: true })} /> : null}
      <Animated.View style={{ transform: [{ translateX: monthTranslate }], opacity: monthOpacity }}>
      <SurfaceCard style={styles.monthCard}>
        <View style={styles.monthNav}>
          <TouchableOpacity style={[styles.monthButton, monthAnimating && styles.monthButtonDisabled]} onPress={() => moveMonth(-1)} disabled={monthAnimating}>
            <Text style={styles.monthButtonText}>Prev</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{month.monthLabel}</Text>
          <TouchableOpacity style={[styles.monthButton, monthAnimating && styles.monthButtonDisabled]} onPress={() => moveMonth(1)} disabled={monthAnimating}>
            <Text style={styles.monthButtonText}>Next</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.weekdays}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
            <Text key={label} style={styles.weekday}>
              {label}
            </Text>
          ))}
        </View>
        <View style={styles.grid}>
          {month.days.map((item) => (
            <View key={item.date} style={styles.cellWrap}>
              <Pressable
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
            </View>
          ))}
        </View>
      </SurfaceCard>
      </Animated.View>

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
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  monthLabel: { flex: 1, textAlign: "center", color: colors.text, ...typography.section },
  monthButton: {
    backgroundColor: colors.surfaceHighest,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  monthButtonDisabled: { opacity: 0.5 },
  monthButtonText: { color: colors.primary, fontWeight: "700" },
  weekdays: { flexDirection: "row", marginHorizontal: -2 },
  weekday: { width: `${100 / 7}%`, paddingHorizontal: 2, textAlign: "center", color: colors.textMuted, ...typography.label },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -2, rowGap: 4 },
  cellWrap: { width: `${100 / 7}%`, paddingHorizontal: 2, paddingTop: 4 },
  cell: {
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

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1, 12);
}

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function isDateInMonth(date: string, month: Date) {
  return date.startsWith(`${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`);
}

function getMonthKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function buildPlaceholderMonth(targetMonth: Date): CalendarMonthDto {
  const firstDay = new Date(Date.UTC(targetMonth.getFullYear(), targetMonth.getMonth(), 1));
  const start = startOfCalendarGrid(firstDay);
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const dateOnly = date.toISOString().slice(0, 10);
    return {
      date: dateOnly,
      inMonth: date.getUTCMonth() === firstDay.getUTCMonth(),
      isToday: dateOnly === toDateOnly(new Date()),
      eventCount: 0,
      highlights: [],
    };
  });

  return {
    monthLabel: targetMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    days,
  };
}

function startOfCalendarGrid(date: Date) {
  const copy = new Date(date);
  const day = copy.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  copy.setUTCDate(copy.getUTCDate() + offset);
  return copy;
}

function runMonthExitAnimation(translate: Animated.Value, opacity: Animated.Value, direction: number) {
  return new Promise<void>((resolve) => {
    Animated.parallel([
      Animated.timing(translate, {
        toValue: direction > 0 ? -22 : 22,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0.35,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(() => resolve());
  });
}

function runMonthEnterAnimation(translate: Animated.Value, opacity: Animated.Value) {
  return new Promise<void>((resolve) => {
    Animated.parallel([
      Animated.timing(translate, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => resolve());
  });
}
