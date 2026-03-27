import process from "node:process";
import { loadConfig } from "../src/config/env.js";
import { buildPreflightReport } from "../apps/api/src/deploy/preflight.js";

try {
  const config = loadConfig(process.cwd());
  const report = buildPreflightReport(config);
  render("errors", report.errors);
  render("warnings", report.warnings);
  render("notes", report.notes);
  if (!report.ok) {
    process.exitCode = 1;
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}

function render(label: string, items: string[]) {
  if (items.length === 0) {
    return;
  }
  console.log(`${label.toUpperCase()}:`);
  for (const item of items) {
    console.log(`- ${item}`);
  }
}
