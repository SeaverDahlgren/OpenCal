import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ensureWorkspace,
  getCliDailyLogPath,
  getCliMemoryPath,
  getCliPromptFilePath,
  getCliSetupStatePath,
  getCliToolsPath,
  getCliUserPath,
  loadWorkspaceFiles,
} from "../src/memory/workspace.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("workspace", () => {
  it("migrates legacy root markdown files into the CLI workspace", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencal-workspace-"));
    tempDirs.push(rootDir);
    await fs.mkdir(path.join(rootDir, ".opencal"), { recursive: true });
    await fs.mkdir(path.join(rootDir, "memory"), { recursive: true });
    await fs.writeFile(path.join(rootDir, "SOUL.md"), "legacy soul", "utf8");
    await fs.writeFile(path.join(rootDir, "USER.md"), "legacy user", "utf8");
    await fs.writeFile(path.join(rootDir, "TOOLS.md"), "legacy tools", "utf8");
    await fs.writeFile(path.join(rootDir, "Memory.md"), "legacy memory", "utf8");
    await fs.writeFile(path.join(rootDir, "memory", "2026-03-26.md"), "legacy daily log", "utf8");
    await fs.writeFile(
      path.join(rootDir, ".opencal", "setup-state.json"),
      JSON.stringify({ personalizationCompletedAt: "2026-03-26T12:00:00.000Z" }),
      "utf8",
    );

    await ensureWorkspace(rootDir);
    const workspace = await loadWorkspaceFiles(rootDir, "2026-03-26");

    expect(workspace.soul).toBe("legacy soul");
    expect(workspace.user).toBe("legacy user");
    expect(workspace.tools).toBe("legacy tools");
    expect(workspace.memory).toBe("legacy memory");
    expect(workspace.dailyLogPath).toBe(getCliDailyLogPath(rootDir, "2026-03-26"));
    expect(await fs.readFile(getCliPromptFilePath(rootDir, "SOUL.md"), "utf8")).toBe("legacy soul");
    expect(await fs.readFile(getCliUserPath(rootDir), "utf8")).toBe("legacy user");
    expect(await fs.readFile(getCliToolsPath(rootDir), "utf8")).toBe("legacy tools");
    expect(await fs.readFile(getCliMemoryPath(rootDir), "utf8")).toBe("legacy memory");
    expect(await fs.readFile(getCliDailyLogPath(rootDir, "2026-03-26"), "utf8")).toBe("legacy daily log");
    expect(JSON.parse(await fs.readFile(getCliSetupStatePath(rootDir), "utf8"))).toMatchObject({
      personalizationCompletedAt: "2026-03-26T12:00:00.000Z",
    });
  });
});
