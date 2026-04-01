import type { SettingsDto } from "../api/types";
import { InlineNotice } from "./InlineNotice";

type PersonalizationPanelProps = {
  data: SettingsDto | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  onChange: (next: SettingsDto) => void;
  onSave: () => Promise<void>;
  onSkip: () => Promise<void>;
};

export function PersonalizationPanel(props: PersonalizationPanelProps) {
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">PERSONALIZATION</p>
          <h2>Set up your preferences</h2>
          <p className="panel__subtitle">Answer four quick questions so OpenCal can personalize planning and advice.</p>
        </div>
      </div>
      {props.error ? <InlineNotice tone="error" message={props.error} /> : null}
      {!props.data ? (
        <article className="card">
          <p className="muted">{props.loading ? "Loading personalization..." : "Unable to load personalization."}</p>
        </article>
      ) : (
        <article className="card">
          <div className="stack">
            <label className="field">
              <span>Current Interests</span>
              <textarea
                rows={3}
                value={props.data.preferences.interests}
                onChange={(event) => props.onChange({
                  ...props.data!,
                  preferences: {
                    ...props.data!.preferences,
                    interests: event.target.value,
                  },
                })}
              />
            </label>
            <div className="field-row">
              <label className="field">
                <span>Work Start</span>
                <input
                  value={props.data.preferences.workStart}
                  onChange={(event) => props.onChange({
                    ...props.data!,
                    preferences: {
                      ...props.data!.preferences,
                      workStart: event.target.value,
                    },
                  })}
                />
              </label>
              <label className="field">
                <span>Work End</span>
                <input
                  value={props.data.preferences.workEnd}
                  onChange={(event) => props.onChange({
                    ...props.data!,
                    preferences: {
                      ...props.data!.preferences,
                      workEnd: event.target.value,
                    },
                  })}
                />
              </label>
            </div>
            <label className="field">
              <span>Meeting Preferences</span>
              <textarea
                rows={3}
                value={props.data.preferences.meetingPreference}
                onChange={(event) => props.onChange({
                  ...props.data!,
                  preferences: {
                    ...props.data!.preferences,
                    meetingPreference: event.target.value,
                  },
                })}
              />
            </label>
            <label className="field">
              <span>Anything else I should know?</span>
              <textarea
                rows={4}
                value={props.data.preferences.additionalContext}
                onChange={(event) => props.onChange({
                  ...props.data!,
                  preferences: {
                    ...props.data!.preferences,
                    additionalContext: event.target.value,
                  },
                })}
              />
            </label>
          </div>
        </article>
      )}
      <div className="button-row">
        <button className="button button--primary" onClick={() => void props.onSave()} disabled={props.saving || !props.data}>
          {props.saving ? "Saving..." : "Save and continue"}
        </button>
        <button className="button button--ghost" onClick={() => void props.onSkip()} disabled={props.saving}>
          Skip for now
        </button>
      </div>
    </section>
  );
}
