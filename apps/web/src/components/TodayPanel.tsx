import type { TodayDto } from "../api/types";
import { InlineNotice } from "./InlineNotice";

type TodayPanelProps = {
  data: TodayDto | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
  onPrompt: (prompt: string) => void;
};

export function TodayPanel({ data, loading, error, onRefresh, onPrompt }: TodayPanelProps) {
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">{formatTodayEyebrow(data?.date)}</p>
          <h2>{data?.greeting ?? "Today"}</h2>
          <p className="panel__subtitle">Strategic overview of your day.</p>
        </div>
        <button className="button button--ghost" onClick={() => void onRefresh()} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      {error ? <InlineNotice tone="error" message={error} /> : null}
      {data?.insight ? (
        <article className="card card--accent">
          <p className="eyebrow">AI INTELLIGENCE</p>
          <h3>{data.insight.title}</h3>
          <p>{data.insight.body}</p>
          {data.insight.action?.prompt ? (
            <button className="link-button" onClick={() => onPrompt(data.insight!.action!.prompt)}>
              {data.insight.actionLabel}
            </button>
          ) : null}
        </article>
      ) : null}
      <article className="card">
        <h3>Today&apos;s Schedule</h3>
        {data?.schedule.length ? (
          <div className="stack">
            {data.schedule.map((event) => (
              <div className="event-row" key={event.eventId}>
                <span className="event-row__track" />
                <div className="stack stack--tight">
                  <p className="label">{event.timeLabel}</p>
                  <h4>{event.title}</h4>
                  {event.attendeePreview.length ? <p className="muted">{event.attendeePreview.join(", ")}</p> : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No events scheduled.</p>
        )}
      </article>
    </section>
  );
}

function formatTodayEyebrow(date?: string) {
  if (!date) {
    return "TODAY";
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
