export type ProductionMemoryRecord = {
  memoryId: string;
  email: string;
  kind: "profile_snapshot";
  summary: string;
  content: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};
