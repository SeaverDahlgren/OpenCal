import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentTurnDto, ChatHistoryDto } from "../api/types";

type ChatPanelProps = {
  history: ChatHistoryDto["messages"];
  pendingTurn: AgentTurnDto | null;
  sending: boolean;
  error: string | null;
  defaultPrompt: string | null;
  onSubmit: (input: { message?: string; action?: "confirm" | "cancel"; optionValue?: string }) => Promise<void>;
};

export function ChatPanel({ history, pendingTurn, sending, error, defaultPrompt, onSubmit }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [showDraftPreview, setShowDraftPreview] = useState(false);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (defaultPrompt && !draft) {
      setDraft(defaultPrompt);
    }
  }, [defaultPrompt, draft]);

  useEffect(() => {
    setShowDraftPreview(false);
  }, [pendingTurn?.confirmation?.payloadPreview.body, pendingTurn?.confirmation?.prompt]);

  useEffect(() => {
    timelineRef.current?.scrollTo({
      top: timelineRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [history.length, pendingTurn]);

  const recommendations = useMemo(
    () => [
      "What does my day look like?",
      "Reschedule my meeting with Joe for tomorrow afternoon.",
      "Draft an email to Sarah about moving our meeting.",
      "How many times am I swimming next month?",
    ],
    [],
  );

  async function submitMessage() {
    if (!draft.trim() || sending) {
      return;
    }
    const next = draft.trim();
    setDraft("");
    await onSubmit({ message: next });
  }

  return (
    <aside className="chat">
      <div className="chat__header">
        <div>
          <p className="eyebrow">AI CHAT</p>
          <h2>OpenCal</h2>
        </div>
        <button className="button button--ghost" onClick={() => setShowHelp((value) => !value)}>
          ?
        </button>
      </div>
      {showHelp ? (
        <div className="card card--soft">
          <p className="eyebrow">START HERE</p>
          <p className="muted">
            Ask OpenCal to plan, reschedule, or draft. The thread stays synced with the backend session.
          </p>
          <p className="eyebrow">TRY ASKING</p>
          <div className="stack stack--tight">
            {recommendations.map((item) => (
              <button className="link-button chat__recommendation" key={item} onClick={() => setDraft(item)}>
                {item}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="chat__timeline" ref={timelineRef}>
        {history.map((message) => (
          <div className={`bubble bubble--${message.role}`} key={message.id}>
            {message.content}
          </div>
        ))}
      </div>
      {error ? <div className="notice notice--error">{error}</div> : null}
      {pendingTurn?.clarification ? (
        <div className="card card--soft">
          <p className="eyebrow">ACTION NEEDED</p>
          <h3>{pendingTurn.clarification.prompt}</h3>
          <div className="stack stack--tight">
            {pendingTurn.clarification.options.map((option) => (
              <button
                className="button button--ghost button--full"
                key={option.id}
                onClick={() => void onSubmit({ optionValue: option.value })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {pendingTurn?.confirmation ? (
        <div className="card card--soft">
          <p className="eyebrow">CONFIRMATION</p>
          <h3>{pendingTurn.confirmation.prompt}</h3>
          <p className="muted">
            {pendingTurn.confirmation.payloadPreview.summary ?? pendingTurn.confirmation.payloadPreview.kind}
          </p>
          {pendingTurn.confirmation.payloadPreview.kind === "write_draft" &&
          pendingTurn.confirmation.payloadPreview.body ? (
            <>
              <button className="link-button" onClick={() => setShowDraftPreview((value) => !value)}>
                {showDraftPreview ? "Hide Full Email" : "Preview Full Email"}
              </button>
              {showDraftPreview ? (
                <div className="draft-preview">
                  {pendingTurn.confirmation.payloadPreview.subject ? (
                    <p className="draft-preview__meta">
                      Subject: {pendingTurn.confirmation.payloadPreview.subject}
                    </p>
                  ) : null}
                  {pendingTurn.confirmation.payloadPreview.recipients?.length ? (
                    <p className="draft-preview__meta">
                      To: {pendingTurn.confirmation.payloadPreview.recipients.join(", ")}
                    </p>
                  ) : null}
                  <pre>{pendingTurn.confirmation.payloadPreview.body}</pre>
                </div>
              ) : null}
            </>
          ) : null}
          <div className="button-row">
            <button className="button button--primary" onClick={() => void onSubmit({ action: "confirm" })}>
              {pendingTurn.confirmation.actionLabel}
            </button>
            <button className="button button--ghost" onClick={() => void onSubmit({ action: "cancel" })}>
              {pendingTurn.confirmation.cancelLabel}
            </button>
          </div>
        </div>
      ) : null}
      <div className="chat__composer">
        <textarea
          rows={3}
          placeholder="Message OpenCal"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button className="button button--primary" onClick={() => void submitMessage()} disabled={sending || !draft.trim()}>
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
    </aside>
  );
}
