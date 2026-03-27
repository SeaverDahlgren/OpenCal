export type AuditEventType =
  | "auth.google.completed"
  | "auth.google.reused"
  | "auth.beta.denied"
  | "session.reset"
  | "session.revoke"
  | "admin.session.reset"
  | "admin.session.revoke"
  | "admin.job.retry"
  | "admin.beta_user.added"
  | "admin.beta_user.removed";

export type AuditEvent = {
  eventId: string;
  type: AuditEventType;
  createdAt: string;
  sessionId?: string;
  userEmail?: string;
  metadata?: Record<string, unknown>;
};
