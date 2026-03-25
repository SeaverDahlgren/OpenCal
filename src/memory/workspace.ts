import fs from "node:fs/promises";
import path from "node:path";

const REQUIRED_FILES = ["SOUL.md", "USER.md", "TOOLS.md", "Memory.md"] as const;

export type WorkspaceFiles = {
  soul: string;
  user: string;
  tools: string;
  memory: string;
  dailyLogPath: string;
};

export async function ensureWorkspace(rootDir: string): Promise<void> {
  await fs.mkdir(path.join(rootDir, "memory"), { recursive: true });
  await fs.mkdir(path.join(rootDir, ".opencal"), { recursive: true });

  for (const file of REQUIRED_FILES) {
    const absolutePath = path.join(rootDir, file);
    try {
      await fs.access(absolutePath);
    } catch {
      await fs.writeFile(absolutePath, "", "utf8");
    }
  }
}

export async function loadWorkspaceFiles(rootDir: string, currentDate: string): Promise<WorkspaceFiles> {
  const [soul, user, tools, memory] = await Promise.all(
    REQUIRED_FILES.map((file) => fs.readFile(path.join(rootDir, file), "utf8")),
  );

  return {
    soul,
    user,
    tools,
    memory,
    dailyLogPath: path.join(rootDir, "memory", `${currentDate}.md`),
  };
}
