import { useState } from "react";
import type { SettingsDto } from "../api/types";
import { InlineNotice } from "./InlineNotice";

type SettingsPanelProps = {
  data: SettingsDto | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  notice: string | null;
  onChange: (next: SettingsDto) => void;
  onSave: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onResetSession: () => Promise<void>;
  onSignOut: () => Promise<void>;
};

export function SettingsPanel(props: SettingsPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!props.data) {
    return (
      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">SETTINGS</p>
            <h2>Settings</h2>
            <p className="panel__subtitle">Update your interests for better daily suggestions and planning.</p>
          </div>
        </div>
        {props.error ? <InlineNotice tone="error" message={props.error} /> : null}
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">SETTINGS</p>
          <h2>Settings</h2>
          <p className="panel__subtitle">Update your interests for better daily suggestions and planning.</p>
        </div>
        <button className="button button--ghost" onClick={() => void props.onRefresh()} disabled={props.loading}>
          {props.loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      {props.notice ? <InlineNotice tone="success" message={props.notice} /> : null}
      {props.error ? <InlineNotice tone="error" message={props.error} /> : null}
      <div className="settings-grid">
        <article className="card">
          <h3>Profile</h3>
          <label className="field">
            <span>Name</span>
            <input
              value={props.data.profile.name}
              onChange={(event) =>
                props.onChange({
                  ...props.data!,
                  profile: {
                    ...props.data!.profile,
                    name: event.target.value,
                  },
                })
              }
            />
          </label>
          <p className="muted">{props.data.profile.email}</p>
        </article>
        <article className="card">
          <h3>Interests</h3>
          <label className="field">
            <span>Interests</span>
            <textarea
              rows={5}
              value={props.data.preferences.interests}
              onChange={(event) =>
                props.onChange({
                  ...props.data!,
                  preferences: {
                    ...props.data!.preferences,
                    interests: event.target.value,
                  },
                })
              }
            />
          </label>
          <p className="muted">Use onboarding to set work hours, meeting preferences, and other planning context.</p>
        </article>
      </div>
      <article className="card">
        <div className="card__header-row">
          <h3>Advanced</h3>
          <button className="button button--ghost" onClick={() => setShowAdvanced((value) => !value)}>
            {showAdvanced ? "Hide" : "Show"}
          </button>
        </div>
        {showAdvanced ? (
          <div className="stack">
            <div className="field-row">
              <label className="field">
                <span>Provider</span>
                <input
                  value={props.data.advanced.provider}
                  onChange={(event) =>
                    props.onChange({
                      ...props.data!,
                      advanced: {
                        ...props.data!.advanced,
                        provider: event.target.value,
                      },
                    })
                  }
                />
              </label>
              <label className="field">
                <span>Verbosity</span>
                <select
                  value={props.data.advanced.toolResultVerbosity}
                  onChange={(event) =>
                    props.onChange({
                      ...props.data!,
                      advanced: {
                        ...props.data!.advanced,
                        toolResultVerbosity: event.target.value === "verbose" ? "verbose" : "compact",
                      },
                    })
                  }
                >
                  <option value="compact">Compact</option>
                  <option value="verbose">Verbose</option>
                </select>
              </label>
            </div>
            <label className="field">
              <span>Model</span>
              <input
                value={props.data.advanced.model}
                onChange={(event) =>
                  props.onChange({
                    ...props.data!,
                    advanced: {
                      ...props.data!.advanced,
                      model: event.target.value,
                    },
                  })
                }
              />
            </label>
            <p className="muted">Session ID: {props.data.advanced.sessionId}</p>
            <div className="button-row">
              <button className="button button--ghost" onClick={() => void props.onResetSession()}>
                Reset Agent Session
              </button>
            </div>
          </div>
        ) : null}
      </article>
      <div className="button-row">
        <button className="button button--primary" onClick={() => void props.onSave()} disabled={props.saving}>
          {props.saving ? "Saving..." : "Save Settings"}
        </button>
        <button className="button button--danger" onClick={() => void props.onSignOut()}>
          Sign Out
        </button>
      </div>
    </section>
  );
}
