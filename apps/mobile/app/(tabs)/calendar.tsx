import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { ActivityIndicator, Animated, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { createApiClient } from "../../src/api/client";
import type { CalendarDayDto, CalendarMonthDto } from "../../src/api/types";
import { EditorialHeader } from "../../src/components/EditorialHeader";
import { InlineNotice } from "../../src/components/InlineNotice";
import { SurfaceCard } from "../../src/components/SurfaceCard";
import { useSession } from "../../src/state/session";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";

export default function CalendarScreen() {
  const { token, scheduleVersion, bumpScheduleVersion } = useSession();
  const [month, setMonth] = useState<CalendarMonthDto | null>(null);
  const [day, setDay] = useState<CalendarDayDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [monthAnimating, setMonthAnimating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createTitle, setCreateTitle] = useState("");
  const [createStartMonth, setCreateStartMonth] = useState(() => new Date().toISOString().slice(5, 7));
  const [createStartDay, setCreateStartDay] = useState(() => new Date().toISOString().slice(8, 10));
  const [createStartYear, setCreateStartYear] = useState(() => new Date().toISOString().slice(0, 4));
  const [createStartTime, setCreateStartTime] = useState("09:00");
  const [createEndMonth, setCreateEndMonth] = useState(() => new Date().toISOString().slice(5, 7));
  const [createEndDay, setCreateEndDay] = useState(() => new Date().toISOString().slice(8, 10));
  const [createEndYear, setCreateEndYear] = useState(() => new Date().toISOString().slice(0, 4));
  const [createEndTime, setCreateEndTime] = useState("10:00");
  const [createLocation, setCreateLocation] = useState("");
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
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
  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const yearOptions = useMemo(() => buildYearOptions(selectedDate.slice(0, 4)), [selectedDate]);
  const startDayOptions = useMemo(() => buildDayOptions(createStartYear, createStartMonth), [createStartMonth, createStartYear]);
  const endDayOptions = useMemo(() => buildDayOptions(createEndYear, createEndMonth), [createEndMonth, createEndYear]);
  const timeOptions = useMemo(() => buildTimeOptions(), []);

  useEffect(() => {
    setCreateStartMonth(selectedDate.slice(5, 7));
    setCreateStartDay(selectedDate.slice(8, 10));
    setCreateStartYear(selectedDate.slice(0, 4));
    setCreateEndMonth(selectedDate.slice(5, 7));
    setCreateEndDay(selectedDate.slice(8, 10));
    setCreateEndYear(selectedDate.slice(0, 4));
  }, [selectedDate]);

  useEffect(() => {
    setCreateStartDay((value) => clampDay(value, createStartYear, createStartMonth));
  }, [createStartMonth, createStartYear]);

  useEffect(() => {
    setCreateEndDay((value) => clampDay(value, createEndYear, createEndMonth));
  }, [createEndMonth, createEndYear]);

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

  function jumpToToday() {
    const today = new Date();
    const todayMonth = startOfMonth(today);
    const todayDate = toDateOnly(today);
    const direction =
      todayMonth.getTime() === visibleMonth.getTime() ? 0 : todayMonth > visibleMonth ? 1 : -1;

    if (direction === 0 && selectedDate === todayDate) {
      return;
    }

    if (direction === 0) {
      setSelectedDate(todayDate);
      setError(null);
      void loadDayData(todayDate);
      return;
    }

    void transitionMonth(todayMonth, todayDate, direction);
  }

  async function createEvent() {
    const eventStartDate = toDateOnlyFromParts(createStartYear, createStartMonth, createStartDay);
    const eventEndDate = toDateOnlyFromParts(createEndYear, createEndMonth, createEndDay);
    if (!token) {
      return;
    }
    if (!createTitle.trim()) {
      setCreateError("Title is required.");
      return;
    }
    if (!eventStartDate || !eventEndDate) {
      setCreateError("Enter a valid start and end date.");
      return;
    }
    if (toTimestamp(eventEndDate, createEndTime) <= toTimestamp(eventStartDate, createStartTime)) {
      setCreateError("End date and time must be after the start date and time.");
      return;
    }
    setCreateSaving(true);
    setCreateError(null);
    try {
      await createApiClient(token).createCalendarEvent({
        summary: createTitle.trim(),
        start: toIsoDateTime(eventStartDate, createStartTime),
        end: toIsoDateTime(eventEndDate, createEndTime),
        location: createLocation.trim() || undefined,
      });
      setCreateTitle("");
      setCreateLocation("");
      setCreateStartTime("09:00");
      setCreateEndTime("10:00");
      setCreateStartMonth(eventStartDate.slice(5, 7));
      setCreateStartDay(eventStartDate.slice(8, 10));
      setCreateStartYear(eventStartDate.slice(0, 4));
      setCreateEndMonth(eventStartDate.slice(5, 7));
      setCreateEndDay(eventStartDate.slice(8, 10));
      setCreateEndYear(eventStartDate.slice(0, 4));
      bumpScheduleVersion();
      await hydrateVisibleCalendar(startOfMonth(new Date(`${eventStartDate}T12:00:00`)), eventStartDate, { refreshing: true });
    } catch (nextError) {
      setCreateError(nextError instanceof Error ? nextError.message : "Failed to create event.");
    } finally {
      setCreateSaving(false);
    }
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
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <EditorialHeader title={month.monthLabel} subtitle="" />
        </View>
        <TouchableOpacity
          style={[styles.todayButton, monthAnimating && styles.monthButtonDisabled]}
          onPress={jumpToToday}
          disabled={monthAnimating}
        >
          <Text style={styles.todayButtonText}>Today</Text>
        </TouchableOpacity>
      </View>
      {error ? <InlineNotice tone="error" message={error} actionLabel="Retry" onPress={() => void hydrateVisibleCalendar(visibleMonth, selectedDate, { refreshing: true })} /> : null}
      <Animated.View style={{ transform: [{ translateX: monthTranslate }], opacity: monthOpacity }}>
      <SurfaceCard style={styles.monthCard}>
        <View style={styles.monthNav}>
          <TouchableOpacity style={[styles.monthButton, monthAnimating && styles.monthButtonDisabled]} onPress={() => moveMonth(-1)} disabled={monthAnimating}>
            <Text style={styles.monthButtonText}>Prev</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{month.monthLabel}</Text>
          <View style={styles.monthActions}>
            <TouchableOpacity style={[styles.monthButton, monthAnimating && styles.monthButtonDisabled]} onPress={() => moveMonth(1)} disabled={monthAnimating}>
            <Text style={styles.monthButtonText}>Next</Text>
          </TouchableOpacity>
          </View>
        </View>
        <View style={styles.weekdays}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
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
        <View style={styles.createCard}>
          <Text style={styles.subsectionTitle}>Add Event</Text>
          {createError ? <InlineNotice tone="error" message={createError} /> : null}
          <Field
            label="Title"
            value={createTitle}
            onChangeText={setCreateTitle}
            placeholder="New event"
          />
          <Text style={styles.groupLabel}>Start</Text>
          <View style={styles.inlineRow}>
            <View style={styles.inlineField}>
              <SelectField label="Month" value={createStartMonth} options={monthOptions} onChange={setCreateStartMonth} />
            </View>
            <View style={styles.inlineField}>
              <SelectField label="Day" value={createStartDay} options={startDayOptions} onChange={setCreateStartDay} />
            </View>
          </View>
          <View style={styles.inlineRow}>
            <View style={styles.inlineField}>
              <SelectField label="Year" value={createStartYear} options={yearOptions} onChange={setCreateStartYear} />
            </View>
            <View style={styles.inlineField}>
              <SelectField label="Time" value={createStartTime} options={timeOptions} onChange={setCreateStartTime} />
            </View>
          </View>
          <Text style={styles.groupLabel}>End</Text>
          <View style={styles.inlineRow}>
            <View style={styles.inlineField}>
              <SelectField label="Month" value={createEndMonth} options={monthOptions} onChange={setCreateEndMonth} />
            </View>
            <View style={styles.inlineField}>
              <SelectField label="Day" value={createEndDay} options={endDayOptions} onChange={setCreateEndDay} />
            </View>
          </View>
          <View style={styles.inlineRow}>
            <View style={styles.inlineField}>
              <SelectField label="Year" value={createEndYear} options={yearOptions} onChange={setCreateEndYear} />
            </View>
            <View style={styles.inlineField}>
              <SelectField label="Time" value={createEndTime} options={timeOptions} onChange={setCreateEndTime} />
            </View>
          </View>
          <Field
            label="Location"
            value={createLocation}
            onChangeText={setCreateLocation}
            placeholder="Optional"
          />
          <TouchableOpacity style={styles.eventCreateButton} onPress={() => void createEvent()} disabled={createSaving}>
            <Text style={styles.eventCreateText}>{createSaving ? "Adding..." : "Add Event"}</Text>
          </TouchableOpacity>
        </View>
      </SurfaceCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 120 },
  loader: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md },
  headerCopy: { flex: 1 },
  todayButton: {
    backgroundColor: colors.surfaceHighest,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  todayButtonText: { color: colors.primary, fontWeight: "700" },
  monthCard: { gap: spacing.md },
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  monthActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
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
  subsectionTitle: { color: colors.text, fontSize: 22, fontWeight: "800" },
  groupLabel: { color: colors.primary, ...typography.label },
  createCard: { gap: spacing.md, paddingBottom: spacing.sm },
  inlineRow: { flexDirection: "row", gap: spacing.md },
  inlineField: { flex: 1 },
  label: { color: colors.textMuted, ...typography.label },
  input: {
    backgroundColor: colors.surfaceHighest,
    borderRadius: radii.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  selectTrigger: {
    backgroundColor: colors.surfaceHighest,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  selectValue: { color: colors.text, flex: 1 },
  selectChevron: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },
  modalFrame: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    maxHeight: "70%",
  },
  modalTitle: { color: colors.text, ...typography.section },
  modalOptions: { gap: spacing.xs },
  modalOption: {
    backgroundColor: colors.surfaceHighest,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  modalOptionSelected: { borderWidth: 1, borderColor: colors.primary },
  modalOptionText: { color: colors.text, fontWeight: "600" },
  modalClose: { alignSelf: "flex-end" },
  modalCloseText: { color: colors.primary, fontWeight: "700" },
  eventCreateButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  eventCreateText: { color: colors.background, fontWeight: "800" },
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

function toIsoDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

function toDateOnlyFromParts(year: string, month: string, day: string) {
  if (!/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month) || !/^\d{1,2}$/.test(day)) {
    return null;
  }
  const normalizedMonth = month.padStart(2, "0");
  const normalizedDay = day.padStart(2, "0");
  const date = new Date(`${year}-${normalizedMonth}-${normalizedDay}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const dateOnly = date.toISOString().slice(0, 10);
  return dateOnly === `${year}-${normalizedMonth}-${normalizedDay}` ? dateOnly : null;
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />
    </View>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = props.options.find((option) => option.value === props.value);

  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{props.label}</Text>
      <TouchableOpacity style={styles.selectTrigger} onPress={() => setOpen(true)} activeOpacity={0.85}>
        <Text style={styles.selectValue}>{selected?.label ?? props.value}</Text>
        <Text style={styles.selectChevron}>▼</Text>
      </TouchableOpacity>
      <Modal transparent animationType="slide" visible={open} onRequestClose={() => setOpen(false)}>
        <View style={styles.modalFrame}>
          <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{props.label}</Text>
            <ScrollView contentContainerStyle={styles.modalOptions}>
              {props.options.map((option) => (
                <TouchableOpacity
                  key={`${props.label}-${option.value}`}
                  style={[styles.modalOption, option.value === props.value && styles.modalOptionSelected]}
                  onPress={() => {
                    props.onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.modalOptionText}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setOpen(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function buildMonthOptions() {
  return Array.from({ length: 12 }, (_, index) => {
    const value = String(index + 1).padStart(2, "0");
    return {
      value,
      label: new Date(`2000-${value}-01T12:00:00`).toLocaleDateString("en-US", { month: "short" }),
    };
  });
}

function buildDayOptions(year: string, month: string) {
  const fallback = Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, "0"));
  const daysInMonth = getDaysInMonth(year, month);
  return (daysInMonth ? fallback.slice(0, daysInMonth) : fallback).map((value) => ({ value, label: value }));
}

function buildYearOptions(anchorYear: string) {
  const base = /^\d{4}$/.test(anchorYear) ? Number(anchorYear) : new Date().getFullYear();
  return Array.from({ length: 6 }, (_, index) => String(base - 1 + index)).map((value) => ({
    value,
    label: value,
  }));
}

function buildTimeOptions() {
  return Array.from({ length: 48 }, (_, index) => {
    const hours = String(Math.floor(index / 2)).padStart(2, "0");
    const minutes = index % 2 === 0 ? "00" : "30";
    const value = `${hours}:${minutes}`;
    return {
      value,
      label: formatTimeLabel(value),
    };
  });
}

function formatTimeLabel(value: string) {
  return new Date(`2000-01-01T${value}:00`).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getDaysInMonth(year: string, month: string) {
  if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month)) {
    return null;
  }
  return new Date(Number(year), Number(month), 0).getDate();
}

function toTimestamp(date: string, time: string) {
  return new Date(`${date}T${time}:00`).getTime();
}

function clampDay(day: string, year: string, month: string) {
  const maxDay = getDaysInMonth(year, month);
  if (!maxDay || !/^\d{2}$/.test(day)) {
    return day;
  }
  return String(Math.min(Number(day), maxDay)).padStart(2, "0");
}
