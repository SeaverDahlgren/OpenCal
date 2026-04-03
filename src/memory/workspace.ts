import fs from "node:fs/promises";
import path from "node:path";

const REQUIRED_FILES = ["SOUL.md", "USER.md", "TOOLS.md", "Memory.md"] as const;
type RequiredFile = (typeof REQUIRED_FILES)[number];

export type WorkspaceFiles = {
  soul: string;
  user: string;
  tools: string;
  memory: string;
  dailyLogPath: string;
  debugLogPath: string;
};

export async function ensureWorkspace(rootDir: string): Promise<void> {
  await fs.mkdir(path.join(rootDir, ".opencal"), { recursive: true });
  await fs.mkdir(getCliWorkspaceDir(rootDir), { recursive: true });
  await fs.mkdir(getCliDailyLogDir(rootDir), { recursive: true });
  await fs.mkdir(path.join(rootDir, ".opencal", "logs"), { recursive: true });
  await migrateLegacyCliWorkspace(rootDir);

  for (const file of REQUIRED_FILES) {
    const absolutePath = getCliPromptFilePath(rootDir, file);
    try {
      await fs.access(absolutePath);
    } catch {
      await fs.writeFile(absolutePath, "", "utf8");
    }
  }
}

export async function loadWorkspaceFiles(rootDir: string, currentDate: string): Promise<WorkspaceFiles> {
  const [soul, user, tools, memory] = await Promise.all(
    REQUIRED_FILES.map((file) => fs.readFile(getCliPromptFilePath(rootDir, file), "utf8")),
  );

  return {
    soul,
    user,
    tools,
    memory,
    dailyLogPath: getCliDailyLogPath(rootDir, currentDate),
    debugLogPath: path.join(rootDir, ".opencal", "logs", `${currentDate}.log`),
  };
}

export function getCliWorkspaceDir(rootDir: string) {
  return path.join(rootDir, ".opencal", "cli");
}

export function getCliPromptFilePath(rootDir: string, file: RequiredFile) {
  return path.join(getCliWorkspaceDir(rootDir), file);
}

export function getCliMemoryPath(rootDir: string) {
  return getCliPromptFilePath(rootDir, "Memory.md");
}

export function getCliUserPath(rootDir: string) {
  return getCliPromptFilePath(rootDir, "USER.md");
}

export function getCliToolsPath(rootDir: string) {
  return getCliPromptFilePath(rootDir, "TOOLS.md");
}

export function getCliDailyLogDir(rootDir: string) {
  return path.join(getCliWorkspaceDir(rootDir), "memory");
}

export function getCliDailyLogPath(rootDir: string, currentDate: string) {
  return path.join(getCliDailyLogDir(rootDir), `${currentDate}.md`);
}

export function getCliSetupStatePath(rootDir: string) {
  return path.join(getCliWorkspaceDir(rootDir), "setup-state.json");
}

async function migrateLegacyCliWorkspace(rootDir: string) {
  for (const file of REQUIRED_FILES) {
    await copyIfPresent(path.join(rootDir, file), getCliPromptFilePath(rootDir, file));
  }

  await copyLegacyDailyLogs(rootDir);
  await copyIfPresent(path.join(rootDir, ".opencal", "setup-state.json"), getCliSetupStatePath(rootDir));
}

async function copyLegacyDailyLogs(rootDir: string) {
  const legacyDir = path.join(rootDir, "memory");
  let entries: string[];
  try {
    entries = await fs.readdir(legacyDir);
  } catch {
    return;
  }

  await fs.mkdir(getCliDailyLogDir(rootDir), { recursive: true });
  await Promise.all(
    entries.map((entry) =>
      copyIfPresent(path.join(legacyDir, entry), path.join(getCliDailyLogDir(rootDir), entry)),
    ),
  );
}

async function copyIfPresent(sourcePath: string, targetPath: string) {
  try {
    await fs.access(targetPath);
    return;
  } catch {
    // target missing; continue
  }

  try {
    await fs.access(sourcePath);
  } catch {
    return;
  }

  await fs.copyFile(sourcePath, targetPath);
}
