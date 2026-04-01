import { useEffect, useMemo, useState } from "react";
import type { CalendarDayDto, CalendarMonthDto } from "../api/types";
import { InlineNotice } from "./InlineNotice";

type CalendarPanelProps = {
  month: CalendarMonthDto | null;
  day: CalendarDayDto | null;
  monthDate: Date;
  selectedDate: string;
  loading: boolean;
  error: string | null;
  onPrev: () => Promise<void>;
  onNext: () => Promise<void>;
  onToday: () => Promise<void>;
  onSelectDay: (date: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onCreateEvent: (input: {
    summary: string;
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    location?: string;
  }) => Promise<void>;
  onPrompt: (prompt: string) => void;
};

export function CalendarPanel(props: CalendarPanelProps) {
  const [showHelp, setShowHelp] = useState(false);
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [location, setLocation] = useState("");
  const [startMonth, setStartMonth] = useState(() => props.selectedDate.slice(5, 7));
  const [startDay, setStartDay] = useState(() => props.selectedDate.slice(8, 10));
  const [startYear, setStartYear] = useState(() => props.selectedDate.slice(0, 4));
  const [endMonth, setEndMonth] = useState(() => props.selectedDate.slice(5, 7));
  const [endDay, setEndDay] = useState(() => props.selectedDate.slice(8, 10));
  const [endYear, setEndYear] = useState(() => props.selectedDate.slice(0, 4));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const weekdayLabels = useMemo(() => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], []);
  const yearOptions = useMemo(() => buildYearOptions(props.selectedDate.slice(0, 4)), [props.selectedDate]);
  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const startDayOptions = useMemo(() => buildDayOptions(startYear, startMonth), [startMonth, startYear]);
  const endDayOptions = useMemo(() => buildDayOptions(endYear, endMonth), [endMonth, endYear]);
  const timeOptions = useMemo(() => buildTimeOptions(), []);

  useEffect(() => {
    setStartMonth(props.selectedDate.slice(5, 7));
    setStartDay(props.selectedDate.slice(8, 10));
    setStartYear(props.selectedDate.slice(0, 4));
    setEndMonth(props.selectedDate.slice(5, 7));
    setEndDay(props.selectedDate.slice(8, 10));
    setEndYear(props.selectedDate.slice(0, 4));
  }, [props.selectedDate]);

  useEffect(() => {
    setStartDay((value) => clampDay(value, startYear, startMonth));
  }, [startMonth, startYear]);

  useEffect(() => {
    setEndDay((value) => clampDay(value, endYear, endMonth));
  }, [endMonth, endYear]);

  async function submitEvent() {
    const eventStartDate = toDateOnlyFromParts(startYear, startMonth, startDay);
    const eventEndDate = toDateOnlyFromParts(endYear, endMonth, endDay);
    if (!title.trim()) {
      setFormError("Title is required.");
      return;
    }
    if (!eventStartDate || !eventEndDate) {
      setFormError("Enter a valid start and end date.");
      return;
    }
    if (toTimestamp(eventEndDate, endTime) <= toTimestamp(eventStartDate, startTime)) {
      setFormError("End date and time must be after the start date and time.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await props.onCreateEvent({
        summary: title.trim(),
        startDate: eventStartDate,
        startTime,
        endDate: eventEndDate,
        endTime,
        location: location.trim() || undefined,
      });
      setTitle("");
      setLocation("");
      setStartTime("09:00");
      setEndTime("10:00");
      setStartMonth(props.selectedDate.slice(5, 7));
      setStartDay(props.selectedDate.slice(8, 10));
      setStartYear(props.selectedDate.slice(0, 4));
      setEndMonth(props.selectedDate.slice(5, 7));
      setEndDay(props.selectedDate.slice(8, 10));
      setEndYear(props.selectedDate.slice(0, 4));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to create event.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">CALENDAR</p>
          <h2>{props.month?.monthLabel ?? formatMonthFallback(props.monthDate)}</h2>
          <p className="panel__subtitle">Browse the month, inspect a day, or queue a reschedule in chat.</p>
        </div>
        <div className="button-row">
          <button className="button button--ghost" onClick={() => void props.onToday()}>
            Today
          </button>
          <button className="button button--ghost" onClick={() => void props.onRefresh()} disabled={props.loading}>
            {props.loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>
      {props.error ? <InlineNotice tone="error" message={props.error} /> : null}
      <div className="calendar-layout">
        <article className="card">
          <div className="calendar-nav">
            <button className="button button--ghost" onClick={() => void props.onPrev()}>
              Prev
            </button>
            <h3>{props.month?.monthLabel ?? formatMonthFallback(props.monthDate)}</h3>
            <button className="button button--ghost" onClick={() => void props.onNext()}>
              Next
            </button>
          </div>
          <div className="calendar-grid calendar-grid--labels">
            {weekdayLabels.map((label) => (
              <span className="calendar-label" key={label}>
                {label}
              </span>
            ))}
          </div>
          <div className="calendar-grid">
            {props.month?.days.map((day) => (
              <button
                className={[
                  "calendar-cell",
                  day.inMonth ? "" : "calendar-cell--muted",
                  day.isToday ? "calendar-cell--today" : "",
                  day.date === props.selectedDate ? "calendar-cell--selected" : "",
                ].join(" ")}
                key={day.date}
                onClick={() => void props.onSelectDay(day.date)}
              >
                <span>{day.date.slice(-2)}</span>
                <div className="calendar-cell__dots">
                  {day.highlights.map((highlight, index) => (
                    <span
                      className={`calendar-dot calendar-dot--${highlight.tone === "tertiary" ? "tertiary" : "primary"}`}
                      key={`${day.date}-${index}`}
                    />
                  ))}
                </div>
                {day.eventCount > 0 ? <small>{day.eventCount}</small> : <small>&nbsp;</small>}
              </button>
            ))}
          </div>
        </article>
        <article className="card">
          <div className="card__header-row">
            <div>
              <h3>{props.day?.dateLabel ?? "Day Details"}</h3>
              <p className="muted">Select a day to see event details.</p>
            </div>
            <button className="button button--ghost" onClick={() => setShowHelp((value) => !value)}>
              {showHelp ? "Hide help" : "Reschedule help"}
            </button>
          </div>
          {showHelp ? (
            <div className="notice notice--neutral">
              Ask chat to reschedule a meeting, then confirm the change. The month bubbles and day list refresh after updates.
            </div>
          ) : null}
          {props.day?.items.length ? (
            <div className="stack">
              {props.day.items.map((item) => (
                <div className="event-card" key={item.eventId}>
                  <p className="label">{item.timeLabel}</p>
                  <h4>{item.title}</h4>
                  {item.attendees.length ? <p className="muted">{item.attendees.map((attendee) => attendee.name).join(", ")}</p> : null}
                  <button
                    className="link-button"
                    onClick={() =>
                      props.onPrompt(
                        `Help me reschedule ${item.title} on ${props.day?.dateLabel ?? props.selectedDate} currently at ${item.timeLabel}.`,
                      )
                    }
                  >
                    Reschedule with AI
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No events for this day.</p>
          )}
          <div className="stack">
            <div className="card__header-row">
              <h3>Add Event</h3>
              <p className="muted">Manual entry</p>
            </div>
            {formError ? <InlineNotice tone="error" message={formError} /> : null}
            <label className="field">
              <span>Title</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="New event" />
            </label>
            <div className="stack stack--tight">
              <p className="label">Start</p>
              <div className="field-row">
                <label className="field">
                  <span>Month</span>
                  <select value={startMonth} onChange={(event) => setStartMonth(event.target.value)}>
                    {monthOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Day</span>
                  <select value={startDay} onChange={(event) => setStartDay(event.target.value)}>
                    {startDayOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="field-row">
                <label className="field">
                  <span>Year</span>
                  <select value={startYear} onChange={(event) => setStartYear(event.target.value)}>
                    {yearOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Time</span>
                  <select value={startTime} onChange={(event) => setStartTime(event.target.value)}>
                    {timeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="stack stack--tight">
              <p className="label">End</p>
              <div className="field-row">
                <label className="field">
                  <span>Month</span>
                  <select value={endMonth} onChange={(event) => setEndMonth(event.target.value)}>
                    {monthOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Day</span>
                  <select value={endDay} onChange={(event) => setEndDay(event.target.value)}>
                    {endDayOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="field-row">
                <label className="field">
                  <span>Year</span>
                  <select value={endYear} onChange={(event) => setEndYear(event.target.value)}>
                    {yearOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Time</span>
                  <select value={endTime} onChange={(event) => setEndTime(event.target.value)}>
                    {timeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <label className="field">
              <span>Location</span>
              <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Optional" />
            </label>
            <div className="button-row">
              <button className="button button--primary" onClick={() => void submitEvent()} disabled={saving}>
                {saving ? "Adding..." : "Add Event"}
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

function formatMonthFallback(value: Date) {
  return value.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
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
    return { value, label: formatTimeLabel(value) };
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
