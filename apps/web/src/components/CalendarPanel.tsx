import { useMemo, useState } from "react";
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
  onPrompt: (prompt: string) => void;
};

export function CalendarPanel(props: CalendarPanelProps) {
  const [showHelp, setShowHelp] = useState(false);
  const weekdayLabels = useMemo(() => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], []);

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
