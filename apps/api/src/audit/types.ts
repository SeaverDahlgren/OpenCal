export type AuditEventType =
  | "auth.google.completed"
  | "auth.google.reused"
  | "session.reset"
  | "session.revoke"
  | "admin.session.reset"
  | "admin.session.revoke"
  | "admin.job.retry";

export type AuditEvent = {
  eventId: string;
  type: AuditEventType;
  createdAt: string;
  sessionId?: string;
  userEmail?: string;
  metadata?: Record<string, unknown>;
};
